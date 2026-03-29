import { command, form, query } from "$app/server";
import { encodeCollection } from "$lib/mappers/collection.mappers";
import { runWithUser } from "$lib/server/run";
import { getStreamServer, getSyncWorkerManager } from "$lib/server/startup";
import { getUserId } from "$lib/server/user";
import { processIconForStorage } from "$lib/server/icon-image";
import { ConnectionType, EventType, type CollectionIcon, type WireEvent } from "@contfu/core";
import {
  iterateDataSources,
  extractNotionIcon,
  notion,
  notionPropertiesToSchema,
  isFullDataSource,
} from "@contfu/svc-sources/notion";
import { iterateContentTypes } from "@contfu/svc-sources/strapi";

function parseIconJson(raw: string | undefined): CollectionIcon | null | undefined {
  if (!raw) return undefined;
  if (raw === "null") return null;
  try {
    return JSON.parse(raw) as CollectionIcon;
  } catch {
    return undefined;
  }
}
import type { CollectionSchema, RefTargets } from "@contfu/svc-core";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/collections/createCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/collections/deleteCollection";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { getCollectionSchema as getCollectionSchemaFeature } from "@contfu/svc-backend/features/collections/getCollectionSchema";
import { listCollections as listCollectionsFeature } from "@contfu/svc-backend/features/collections/listCollections";
import { listCollectionsByConnection as listCollectionsByConnectionFeature } from "@contfu/svc-backend/features/collections/listCollectionsByConnection";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
import { listFlowsByCollection } from "@contfu/svc-backend/features/flows/listFlowsByCollection";
import { getConnectionWithCredentials } from "@contfu/svc-backend/features/connections/getConnectionWithCredentials";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { error, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all Collections for the current user.
 */
export const getCollections = query(async () => {
  const userId = getUserId();
  const collections = await runWithUser(userId, listCollectionsFeature());
  return collections.map(encodeCollection);
});

/**
 * Get a single Collection by ID.
 */
export const getCollection = query(v.object({ id: idSchema("collection") }), async ({ id }) => {
  const userId = getUserId();
  const collection = await runWithUser(userId, getCollectionFeature(id));
  if (!collection) error(404, "Collection not found");
  return encodeCollection(collection);
});

/**
 * Get collections filtered by connection ID.
 */
export const getCollectionsByConnection = query(
  v.object({ connectionId: idSchema("connection") }),
  async ({ connectionId }) => {
    const userId = getUserId();
    const collections = await runWithUser(userId, listCollectionsByConnectionFeature(connectionId));
    return collections.map(encodeCollection);
  },
);

/**
 * Create a new Collection.
 * Optionally bind it to a connection via connectionId + ref.
 */
export const createCollection = form(
  v.object({
    displayName: v.pipe(v.string(), v.nonEmpty("Display name is required")),
    name: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^[a-z][a-zA-Z0-9]*$/, "Must be a camelCase identifier (e.g. blogPosts)"),
      ),
    ),
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
    connectionId: v.optional(idSchema("connection")),
    ref: v.optional(v.string()),
    icon: v.optional(v.string()), // JSON-serialized CollectionIcon
  }),
  async (data) => {
    const userId = getUserId();
    const collection = await runWithUser(
      userId,
      createCollectionFeature(userId, {
        displayName: data.displayName,
        name: data.name,
        includeRef: data.includeRef ?? true,
        connectionId: data.connectionId,
        ref: data.ref,
        icon: await processIconForStorage(parseIconJson(data.icon)),
      }),
    );

    if (data.connectionId != null) {
      getStreamServer().sendToConnection(userId, data.connectionId, [
        EventType.COLLECTION_SCHEMA,
        collection.name,
        collection.displayName,
        {},
      ]);
    }

    redirect(303, `/collections/${encodeId("collection", collection.id)}`);
  },
);

/**
 * Update a Collection.
 */
export const updateCollection = form(
  v.object({
    id: idSchema("collection"),
    displayName: v.optional(v.string()),
    name: v.optional(
      v.pipe(
        v.string(),
        v.regex(/^[a-z][a-zA-Z0-9]*$/, "Must be a camelCase identifier (e.g. blogPosts)"),
      ),
    ),
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
    schema: v.optional(v.string()), // JSON string of CollectionSchema
    icon: v.optional(v.string()), // JSON-serialized CollectionIcon, or "null" to clear
  }),
  async (data) => {
    const userId = getUserId();

    // Fetch current collection before update to detect renames
    const oldCollection = await runWithUser(userId, getCollectionFeature(data.id));

    await runWithUser(
      userId,
      updateCollectionFeature(data.id, {
        displayName: data.displayName,
        name: data.name,
        includeRef: data.includeRef,
        schema: data.schema && JSON.parse(data.schema),
        icon: await processIconForStorage(parseIconJson(data.icon)),
      }),
    );

    // Broadcast COLLECTION_RENAMED if name changed
    if (oldCollection && data.name && data.name !== oldCollection.name) {
      const newDisplayName = data.displayName ?? oldCollection.displayName;
      const renamedEvent: WireEvent = [
        EventType.COLLECTION_RENAMED,
        oldCollection.name,
        data.name,
        newDisplayName,
      ];
      await getStreamServer().broadcastToCollection(userId, data.id, renamedEvent);
    }

    return { success: true };
  },
);

/**
 * Delete a Collection.
 */
export const deleteCollection = form(v.object({ id: idSchema("collection") }), async (data) => {
  const userId = getUserId();

  // Fetch collection and its flows before delete (cascade deletes flows)
  const collection = await runWithUser(userId, getCollectionFeature(data.id));
  const flows = collection ? await runWithUser(userId, listFlowsByCollection(data.id)) : [];

  await runWithUser(userId, deleteCollectionFeature(data.id));

  // Broadcast COLLECTION_REMOVED to target collections of outbound flows
  if (collection) {
    const server = getStreamServer();
    const removedEvent: WireEvent = [EventType.COLLECTION_REMOVED, collection.name];
    for (const flow of flows) {
      if (flow.targetId !== data.id) {
        server.broadcastToCollection(userId, flow.targetId, removedEvent);
      }
    }
  }

  return { success: true };
});

/**
 * Programmatic schema update (command, not form) for use in saveMappings().
 */
export const updateCollectionSchema = command(
  v.object({
    id: idSchema("collection"),
    schema: v.string(), // JSON string of CollectionSchema
    refTargets: v.optional(v.string()), // JSON string of RefTargets
  }),
  async (data) => {
    const userId = getUserId();
    const schema = JSON.parse(data.schema) as CollectionSchema;
    const refTargets = data.refTargets ? (JSON.parse(data.refTargets) as RefTargets) : undefined;

    const oldCollection = await runWithUser(userId, getCollectionFeature(data.id));
    const oldSchema = oldCollection?.schema ?? null;

    await runWithUser(userId, updateCollectionFeature(data.id, { schema, refTargets }));

    const schemaChanged = JSON.stringify(oldSchema) !== JSON.stringify(schema);
    if (schemaChanged) {
      await getSyncWorkerManager().broadcastSchema(userId, data.id);
    }

    return { success: true };
  },
);

/**
 * Get the schema for a collection.
 */
export const getCollectionSchema = query(
  v.object({ collectionId: idSchema("collection") }),
  async ({ collectionId }): Promise<CollectionSchema | null> => {
    const userId = getUserId();
    return runWithUser(userId, getCollectionSchemaFeature(collectionId));
  },
);

export type DiscoveredCollection = {
  ref: string;
  displayName: string;
  alreadyImported: boolean;
  icon?: CollectionIcon | null;
};

/**
 * Discover available collections from a connection (e.g. Notion databases).
 */
export const discoverCollections = query(
  v.object({ connectionId: idSchema("connection") }),
  async ({ connectionId }): Promise<DiscoveredCollection[]> => {
    const userId = getUserId();
    const connection = await runWithUser(userId, getConnectionWithCredentials(connectionId));
    if (!connection) error(404, "Connection not found");

    const credentials = connection.credentials?.toString("utf-8") ?? "";
    if (!credentials) return [];

    if (connection.type !== ConnectionType.NOTION && connection.type !== ConnectionType.STRAPI)
      return [];

    // Get already-imported refs for this connection
    const existing = await runWithUser(userId, listCollectionsByConnectionFeature(connectionId));
    const importedRefs = new Set(existing.map((c) => c.refString).filter(Boolean));

    const discovered: DiscoveredCollection[] = [];

    if (connection.type === ConnectionType.NOTION) {
      for await (const ds of iterateDataSources(credentials)) {
        const titleParts = (ds as { title?: Array<{ plain_text?: string }> }).title ?? [];
        const displayName = titleParts.map((t) => t.plain_text ?? "").join("") || "Untitled";
        discovered.push({
          ref: ds.id,
          displayName,
          alreadyImported: importedRefs.has(ds.id),
          icon: extractNotionIcon(ds),
        });
      }
    } else if (connection.type === ConnectionType.STRAPI) {
      const url = connection.url ?? "";
      for await (const ct of iterateContentTypes(url, credentials)) {
        discovered.push({
          ref: ct.uid,
          displayName: ct.info.displayName,
          alreadyImported: importedRefs.has(ct.uid),
        });
      }
    }

    return discovered;
  },
);

/**
 * Import multiple collections from a connection at once.
 */
export const importCollections = command(
  v.object({
    connectionId: idSchema("connection"),
    items: v.array(
      v.object({
        ref: v.string(),
        displayName: v.string(),
      }),
    ),
  }),
  async (data) => {
    const userId = getUserId();

    // Fetch connection once (needed for schema seeding)
    const connection = await runWithUser(userId, getConnectionWithCredentials(data.connectionId));

    // Pre-fetch all Notion data sources in parallel to avoid sequential round-trips.
    // Schema seeding is best-effort so failures are silenced individually.
    type SeedData = {
      schema: import("@contfu/svc-core").CollectionSchema;
      icon: CollectionIcon | null | undefined;
    } | null;
    let seedMap = new Map<string, SeedData>();
    if (connection?.type === ConnectionType.NOTION && connection.credentials) {
      const auth = connection.credentials.toString("utf-8");
      const fetched = await Promise.allSettled(
        data.items.map(async (item) => {
          const dataSource = await notion.dataSources.retrieve({
            auth,
            data_source_id: item.ref,
          });
          if (!isFullDataSource(dataSource)) return { ref: item.ref, seed: null };
          const schema = notionPropertiesToSchema(dataSource.properties);
          const icon = await processIconForStorage(extractNotionIcon(dataSource));
          return { ref: item.ref, seed: { schema, icon } };
        }),
      );
      for (const result of fetched) {
        if (result.status === "fulfilled" && result.value) {
          seedMap.set(result.value.ref, result.value.seed);
        }
      }
    }

    // Create collections sequentially to avoid quota race conditions.
    const results: Array<{ ref: string; id: string }> = [];
    for (const item of data.items) {
      const seed = seedMap.get(item.ref);
      const collection = await runWithUser(
        userId,
        createCollectionFeature(userId, {
          displayName: item.displayName,
          connectionId: data.connectionId,
          ref: item.ref,
          icon: seed?.icon,
        }),
      );

      if (seed?.schema) {
        try {
          await runWithUser(
            userId,
            updateCollectionFeature(collection.id, { schema: seed.schema }),
          );
        } catch {
          // Schema seeding is best-effort; collection is still usable
        }
      }

      results.push({ ref: item.ref, id: encodeId("collection", collection.id) });
    }
    return { imported: results.length };
  },
);
