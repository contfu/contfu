import { command, form, query } from "$app/server";
import { encodeCollection } from "$lib/mappers/collection.mappers";
import { runWithUser } from "$lib/server/run";
import { getStreamServer, getSyncWorkerManager } from "$lib/server/startup";
import { getUserId } from "$lib/server/user";
import { EventType, type WireEvent } from "@contfu/core";
import type { CollectionSchema, RefTargets } from "@contfu/svc-core";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/collections/createCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/collections/deleteCollection";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { listCollections as listCollectionsFeature } from "@contfu/svc-backend/features/collections/listCollections";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
import { listConnectionsByCollection } from "@contfu/svc-backend/features/connections/listConnectionsByCollection";
import { createInflux } from "@contfu/svc-backend/features/influxes/createInflux";
import { createSourceCollection as createSourceCollectionFeature } from "@contfu/svc-backend/features/source-collections/createSourceCollection";
import { getCollectionSchema } from "@contfu/svc-backend/features/source-collections/getCollectionSchema";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { error, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all Collections for the current user.
 */
export const getCollections = query(async () => {
  const userId = getUserId();
  const collections = await runWithUser(userId, listCollectionsFeature(userId));
  return collections.map(encodeCollection);
});

/**
 * Get a single Collection by ID.
 */
export const getCollection = query(v.object({ id: idSchema("collection") }), async ({ id }) => {
  const userId = getUserId();
  const collection = await runWithUser(userId, getCollectionFeature(userId, id));
  if (!collection) error(404, "Collection not found");
  return encodeCollection(collection);
});

/**
 * Create a new Collection.
 * Optionally create a SourceCollection and link it via an influx in one step.
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
    // Optional: create and link a SourceCollection in one step
    sourceId: v.optional(idSchema("source")),
    ref: v.optional(v.string()), // Content type UID, e.g., "api::article.article"
  }),
  async (data) => {
    const userId = getUserId();
    const collection = await runWithUser(
      userId,
      createCollectionFeature(userId, {
        displayName: data.displayName,
        name: data.name,
        includeRef: data.includeRef ?? true,
      }),
    );

    // If sourceId + ref provided, create SourceCollection and link it via influx
    if (data.sourceId && data.ref) {
      const sourceCollection = await runWithUser(
        userId,
        createSourceCollectionFeature(userId, {
          name: data.displayName,
          sourceId: data.sourceId,
          ref: Buffer.from(data.ref, "utf-8"),
        }),
      );
      await runWithUser(
        userId,
        createInflux(userId, {
          collectionId: collection.id,
          sourceCollectionId: sourceCollection.id,
          includeRef: true,
        }),
      );
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
  }),
  async (data) => {
    const userId = getUserId();

    // Fetch current collection before update to detect renames
    const oldCollection = await runWithUser(userId, getCollectionFeature(userId, data.id));

    await runWithUser(
      userId,
      updateCollectionFeature(userId, data.id, {
        displayName: data.displayName,
        name: data.name,
        includeRef: data.includeRef,
        schema: data.schema && JSON.parse(data.schema),
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

  // Fetch collection name and connections before delete (cascade deletes connections)
  const collection = await runWithUser(userId, getCollectionFeature(userId, data.id));
  const connections = collection
    ? await runWithUser(userId, listConnectionsByCollection(userId, data.id))
    : [];

  await runWithUser(userId, deleteCollectionFeature(userId, data.id));

  // Broadcast COLLECTION_REMOVED to formerly-connected consumers
  if (collection) {
    const server = getStreamServer();
    const removedEvent: WireEvent = [EventType.COLLECTION_REMOVED, collection.name];
    for (const conn of connections) {
      server.sendToConsumer(conn.userId, conn.consumerId, removedEvent);
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

    const oldCollection = await runWithUser(userId, getCollectionFeature(userId, data.id));
    const oldSchema = oldCollection?.schema ?? null;

    await runWithUser(userId, updateCollectionFeature(userId, data.id, { schema, refTargets }));

    const schemaChanged = JSON.stringify(oldSchema) !== JSON.stringify(schema);
    if (schemaChanged) {
      await getSyncWorkerManager().broadcastSchema(userId, data.id);
    }

    return { success: true };
  },
);

/**
 * Get the schema for a source collection.
 */
export const getSourceCollectionSchemaQuery = query(
  v.object({ sourceCollectionId: idSchema("sourceCollection") }),
  async ({ sourceCollectionId }): Promise<CollectionSchema | null> => {
    const userId = getUserId();
    return runWithUser(userId, getCollectionSchema(userId, sourceCollectionId));
  },
);
