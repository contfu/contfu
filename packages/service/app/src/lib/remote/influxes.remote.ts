import { command, form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import type { CollectionSchema, Filter } from "@contfu/svc-core";
import type { BackendInfluxWithDetails } from "@contfu/svc-backend/domain/types";
import { addInfluxWithSourceCollection } from "@contfu/svc-backend/features/influxes";
import { deleteInflux as deleteInfluxFeature } from "@contfu/svc-backend/features/influxes/deleteInflux";
import { listInfluxes } from "@contfu/svc-backend/features/influxes/listInfluxes";
import { updateInflux as updateInfluxFeature } from "@contfu/svc-backend/features/influxes/updateInflux";
import { listCollectionSummariesBySource } from "@contfu/svc-backend/features/source-collections/listCollectionSummariesBySource";
import { getSourceWithCredentials } from "@contfu/svc-backend/features/sources/getSourceWithCredentials";
import { listSources } from "@contfu/svc-backend/features/sources/listSources";
import { SourceType } from "@contfu/svc-backend/features/sources/testSourceConnection";
import { db } from "@contfu/svc-backend/infra/db/db";
import { influxTable } from "@contfu/svc-backend/infra/db/schema";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import {
  iterateDataSources,
  notionPropertiesToSchema,
  type DataSourceResult,
} from "@contfu/svc-sources/notion";
import { invalid } from "@sveltejs/kit";
import { and, eq } from "drizzle-orm";
import { lru } from "tiny-lru";
import * as v from "valibot";

// ============================================================
// Cache
// ============================================================

/** LRU cache for Notion data sources by userId:sourceId. */
const notionDataSourcesCache = lru<Omit<DataSourceInfo, "exists" | "sourceCollectionId">[]>(
  100,
  5 * 60 * 1000,
);

// ============================================================
// Types
// ============================================================

export interface DataSourceInfo {
  id: string;
  title: string;
  icon: { type: "emoji" | "external" | "file"; value: string } | null;
  /** Schema from the source (Notion properties converted) */
  schema: CollectionSchema | null;
  /** True if already exists as a SourceCollection */
  exists: boolean;
  /** If exists, the source collection ID (encoded) */
  sourceCollectionId?: string | number;
}

export interface SourceWithDataSources {
  sourceId: string | number;
  sourceName: string | null;
  sourceType: number;
  dataSources: DataSourceInfo[];
  /** For Web sources, allow creating custom paths */
  allowCustomPath?: boolean;
  error?: string;
}

// ============================================================
// Helpers
// ============================================================

function parseNotionDataSource(
  ds: DataSourceResult,
): Omit<DataSourceInfo, "exists" | "sourceCollectionId"> {
  const title = ds.title?.[0]?.plain_text || "Untitled";

  let icon: DataSourceInfo["icon"] = null;
  const dsIcon = ds.icon;

  if (dsIcon?.type === "emoji") {
    icon = { type: "emoji", value: dsIcon.emoji };
  } else if (dsIcon?.type === "external") {
    icon = { type: "external", value: dsIcon.external.url };
  } else if (dsIcon?.type === "file") {
    icon = { type: "file", value: dsIcon.file.url };
  }

  // Extract schema from properties using backend feature
  const schema = ds.properties ? notionPropertiesToSchema(ds.properties) : null;

  return {
    id: ds.id,
    title,
    icon,
    schema,
  };
}

// ============================================================
// Probe All Sources
// ============================================================

/**
 * Probe all user sources for available data sources.
 * - Notion: Fetches databases from API
 * - Strapi: Returns existing source collections (discovered via webhooks)
 * - Web: Returns existing source collections + allows custom paths
 */
export const probeAllSources = query(async (): Promise<SourceWithDataSources[]> => {
  const userId = getUserId();
  const sources = await listSources(userId);

  const results: SourceWithDataSources[] = [];

  for (const source of sources) {
    const result: SourceWithDataSources = {
      sourceId: encodeId("source", source.id),
      sourceName: source.name,
      sourceType: source.type,
      dataSources: [],
      allowCustomPath: source.type === SourceType.WEB,
    };

    try {
      // Get existing source collections for this source
      const existingCollections = await listCollectionSummariesBySource(userId, source.id);
      const existingRefMap = new Map(
        existingCollections.filter((c) => c.refString).map((c) => [c.refString!, c.id]),
      );

      if (source.type === SourceType.NOTION) {
        // Check cache first
        const cacheKey = `notion-ds:${userId}:${source.id}`;
        const cached = notionDataSourcesCache.get(cacheKey);

        let parsedDataSources: Omit<DataSourceInfo, "exists" | "sourceCollectionId">[];

        if (cached) {
          // Cache hit - use cached data
          parsedDataSources = cached;
        } else {
          // Cache miss - fetch from Notion API
          const sourceWithCreds = await getSourceWithCredentials(userId, source.id);
          const token = sourceWithCreds?.credentials?.toString("utf-8");

          if (token) {
            parsedDataSources = [];
            for await (const ds of iterateDataSources(token)) {
              parsedDataSources.push(parseNotionDataSource(ds));
            }
            // Store in cache
            notionDataSourcesCache.set(cacheKey, parsedDataSources);
          } else {
            result.error = "No API token configured";
            parsedDataSources = [];
          }
        }

        // Enrich with exists/sourceCollectionId from DB
        result.dataSources = parsedDataSources.map((ds) => {
          const existingId = existingRefMap.get(ds.id);
          return {
            ...ds,
            exists: existingId !== undefined,
            sourceCollectionId:
              existingId !== undefined ? encodeId("sourceCollection", existingId) : undefined,
          };
        });
      } else {
        // Strapi and Web: Show existing source collections
        // (Strapi collections are auto-discovered via webhooks)
        result.dataSources = existingCollections.map((c) => ({
          id: c.refString ?? String(c.id),
          title: c.name,
          icon: null,
          schema: null, // Will be fetched from source collection
          exists: true,
          sourceCollectionId: encodeId("sourceCollection", c.id),
        }));
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : "Unknown error";
    }

    results.push(result);
  }

  return results;
});

// ============================================================
// Refresh Source Data Sources
// ============================================================

/**
 * Refresh cached data sources for a specific source.
 * Fetches fresh data from the API and updates cache only on success.
 * Returns error if fetch fails (preserving existing cache).
 */
export const refreshSourceDataSources = command(
  v.object({
    sourceId: idSchema("source"),
  }),
  async (data): Promise<{ success: true } | { success: false; error: string }> => {
    const userId = getUserId();
    const cacheKey = `notion-ds:${userId}:${data.sourceId}`;

    try {
      // Get source to check type
      const sources = await listSources(userId);
      const source = sources.find((s) => s.id === data.sourceId);

      if (!source) {
        return { success: false, error: "Source not found" };
      }

      // Only Notion sources have cached data sources
      if (source.type !== SourceType.NOTION) {
        return { success: true };
      }

      // Fetch fresh data from Notion API
      const sourceWithCreds = await getSourceWithCredentials(userId, source.id);
      const token = sourceWithCreds?.credentials?.toString("utf-8");

      if (!token) {
        return { success: false, error: "No API token configured" };
      }

      const parsedDataSources: Omit<DataSourceInfo, "exists" | "sourceCollectionId">[] = [];
      for await (const ds of iterateDataSources(token)) {
        parsedDataSources.push(parseNotionDataSource(ds));
      }

      // Only update cache if fetch succeeded
      notionDataSourcesCache.set(cacheKey, parsedDataSources);
      return { success: true };
    } catch (err) {
      // On error, preserve existing cache
      return {
        success: false,
        error: err instanceof Error ? err.message : "Failed to refresh data sources",
      };
    }
  },
);

// ============================================================
// Add Influx
// ============================================================

/**
 * Add an influx to a collection, auto-creating the SourceCollection if needed.
 * Thin wrapper around the backend feature.
 */
export const addInflux = command(
  v.object({
    collectionId: idSchema("collection"),
    sourceId: idSchema("source"),
    ref: v.string(),
    name: v.string(),
    existingSourceCollectionId: v.optional(idSchema("sourceCollection")),
    filters: v.optional(v.string()), // JSON string of Filter[]
    schema: v.optional(v.string()), // JSON string of CollectionSchema
  }),
  async (
    data,
  ): Promise<
    | { success: true; sourceCollectionId: string; influxId: string }
    | { success: false; error: string }
  > => {
    const userId = getUserId();

    // Parse filters if provided
    let filters: Filter[] | undefined;
    if (data.filters) {
      try {
        filters = JSON.parse(data.filters) as Filter[];
      } catch {
        invalid("Invalid filters JSON");
      }
    }

    // Parse schema if provided
    let schema: CollectionSchema | undefined;
    if (data.schema) {
      try {
        schema = JSON.parse(data.schema) as CollectionSchema;
      } catch {
        invalid("Invalid schema JSON");
      }
    }

    // Call backend feature
    const result = await addInfluxWithSourceCollection(userId, {
      collectionId: data.collectionId,
      sourceId: data.sourceId,
      ref: data.ref,
      name: data.name,
      existingSourceCollectionId: data.existingSourceCollectionId,
      filters,
      schema,
    });

    if (!result.success) return result;
    return {
      success: true as const,
      sourceCollectionId: encodeId("sourceCollection", result.sourceCollectionId),
      influxId: encodeId("influx", result.influxId),
    };
  },
);

// Keep old export name for backwards compatibility
export const addInfluxWithAutoCreate = addInflux;

// ============================================================
// Get Influxes
// ============================================================

/**
 * Get all influxes for a collection with source details.
 */
function encodeInflux(influx: BackendInfluxWithDetails) {
  return {
    ...influx,
    id: encodeId("influx", influx.id),
    sourceCollectionId: encodeId("sourceCollection", influx.sourceCollectionId),
    sourceId: encodeId("source", influx.sourceId),
  };
}

export const getInfluxes = query(
  v.object({ collectionId: idSchema("collection") }),
  async ({ collectionId }) => {
    const userId = getUserId();
    const influxes = await listInfluxes(userId, collectionId);
    return influxes.map(encodeInflux);
  },
);

// ============================================================
// Remove Influx
// ============================================================

/**
 * Remove an influx from a collection by source collection ID.
 */
export const removeInflux = form(v.object({ id: idSchema("influx") }), async (data) => {
  const userId = getUserId();
  await deleteInfluxFeature(userId, data.id);
  return { success: true };
});

// ============================================================
// Update Influx
// ============================================================

/**
 * Update an influx's filters by looking up via collectionId + sourceCollectionId.
 */
export const updateInfluxForm = form(
  v.object({
    collectionId: idSchema("collection"),
    sourceCollectionId: idSchema("sourceCollection"),
    filters: v.optional(v.string()), // JSON string of Filter[]
  }),
  async (data, issue) => {
    const userId = getUserId();

    let filters: Filter[] | null = null;
    if (data.filters) {
      try {
        filters = JSON.parse(data.filters) as Filter[];
      } catch {
        throw issue.filters("Invalid filters JSON");
      }
    }

    // Find influx by collectionId + sourceCollectionId
    const [influx] = await db
      .select({ id: influxTable.id })
      .from(influxTable)
      .where(
        and(
          eq(influxTable.userId, userId),
          eq(influxTable.collectionId, data.collectionId),
          eq(influxTable.sourceCollectionId, data.sourceCollectionId),
        ),
      );

    if (!influx) {
      throw issue.sourceCollectionId("Influx not found");
    }

    const result = await updateInfluxFeature(userId, {
      id: influx.id,
      filters,
    });

    if (!result) {
      throw issue.sourceCollectionId("Failed to update influx");
    }

    return { success: true };
  },
);
