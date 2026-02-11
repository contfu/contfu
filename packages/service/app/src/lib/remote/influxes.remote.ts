import { command, form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import type { CollectionSchema, Filter, InfluxWithDetails } from "@contfu/core";
import { addInfluxWithSourceCollection } from "@contfu/svc-backend/features/influxes";
import { deleteInfluxByMapping } from "@contfu/svc-backend/features/influxes/deleteInfluxByMapping";
import { listInfluxes } from "@contfu/svc-backend/features/influxes/listInfluxes";
import { updateInflux as updateInfluxFeature } from "@contfu/svc-backend/features/influxes/updateInflux";
import { listCollectionSummariesBySource } from "@contfu/svc-backend/features/source-collections/listCollectionSummariesBySource";
import { getSourceWithCredentials } from "@contfu/svc-backend/features/sources/getSourceWithCredentials";
import { listSources } from "@contfu/svc-backend/features/sources/listSources";
import { SourceType } from "@contfu/svc-backend/features/sources/testSourceConnection";
import { db } from "@contfu/svc-backend/infra/db/db";
import { influxTable } from "@contfu/svc-backend/infra/db/schema";
import {
  iterateDataSources,
  notionPropertiesToSchema,
  type DataSourceResult,
} from "@contfu/svc-sources/notion";
import { and, eq } from "drizzle-orm";
import * as v from "valibot";

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
  /** If exists, the source collection ID */
  sourceCollectionId?: number;
}

export interface SourceWithDataSources {
  sourceId: number;
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
      sourceId: source.id,
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
        // Fetch Notion databases from API
        const sourceWithCreds = await getSourceWithCredentials(userId, source.id);
        const token = sourceWithCreds?.credentials?.toString("utf-8");

        if (token) {
          const notionDatabases: DataSourceInfo[] = [];
          for await (const ds of iterateDataSources(token)) {
            const parsed = parseNotionDataSource(ds);
            const existingId = existingRefMap.get(ds.id);
            notionDatabases.push({
              ...parsed,
              exists: existingId !== undefined,
              sourceCollectionId: existingId,
            });
          }
          result.dataSources = notionDatabases;
        } else {
          result.error = "No API token configured";
        }
      } else {
        // Strapi and Web: Show existing source collections
        // (Strapi collections are auto-discovered via webhooks)
        result.dataSources = existingCollections.map((c) => ({
          id: c.refString ?? String(c.id),
          title: c.name,
          icon: null,
          schema: null, // Will be fetched from source collection
          exists: true,
          sourceCollectionId: c.id,
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
// Add Influx
// ============================================================

/**
 * Add an influx to a collection, auto-creating the SourceCollection if needed.
 * Thin wrapper around the backend feature.
 */
export const addInflux = command(
  v.object({
    collectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    sourceId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    ref: v.string(),
    name: v.string(),
    existingSourceCollectionId: v.optional(
      v.pipe(
        v.union([v.string(), v.number()]),
        v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
        v.number(),
      ),
    ),
    filters: v.optional(v.string()), // JSON string of Filter[]
    schema: v.optional(v.string()), // JSON string of CollectionSchema
  }),
  async (
    data,
  ): Promise<
    | { success: true; sourceCollectionId: number; influxId: number }
    | { success: false; error: string }
  > => {
    const userId = getUserId();

    // Parse filters if provided
    let filters: Filter[] | undefined;
    if (data.filters) {
      try {
        filters = JSON.parse(data.filters) as Filter[];
      } catch {
        return { success: false, error: "Invalid filters JSON" };
      }
    }

    // Parse schema if provided
    let schema: CollectionSchema | undefined;
    if (data.schema) {
      try {
        schema = JSON.parse(data.schema) as CollectionSchema;
      } catch {
        return { success: false, error: "Invalid schema JSON" };
      }
    }

    // Call backend feature
    return addInfluxWithSourceCollection(userId, {
      collectionId: data.collectionId,
      sourceId: data.sourceId,
      ref: data.ref,
      name: data.name,
      existingSourceCollectionId: data.existingSourceCollectionId,
      filters,
      schema,
    });
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
export const getInfluxes = query(
  v.object({ collectionId: v.number() }),
  async ({ collectionId }): Promise<InfluxWithDetails[]> => {
    const userId = getUserId();
    return listInfluxes(userId, collectionId);
  },
);

// ============================================================
// Remove Influx
// ============================================================

/**
 * Remove an influx from a collection by source collection ID.
 */
export const removeInflux = form(
  v.object({
    collectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    sourceCollectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data) => {
    const userId = getUserId();
    await deleteInfluxByMapping(userId, data.collectionId, data.sourceCollectionId);
    return { success: true };
  },
);

// ============================================================
// Update Influx
// ============================================================

/**
 * Update an influx's filters by looking up via collectionId + sourceCollectionId.
 */
export const updateInfluxForm = form(
  v.object({
    collectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    sourceCollectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
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
