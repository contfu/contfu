import { form, query } from "$app/server";
import { encodeCollection } from "$lib/mappers/collection.mappers";
import { runWithUser } from "$lib/server/run";
import { getUserId } from "$lib/server/user";
import type { CollectionSchema } from "@contfu/svc-core";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/collections/createCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/collections/deleteCollection";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { listCollections as listCollectionsFeature } from "@contfu/svc-backend/features/collections/listCollections";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
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
  }),
  async (data) => {
    const userId = getUserId();
    await runWithUser(
      userId,
      updateCollectionFeature(userId, data.id, {
        displayName: data.displayName,
        name: data.name,
        includeRef: data.includeRef,
      }),
    );
    return { success: true };
  },
);

/**
 * Delete a Collection.
 */
export const deleteCollection = form(v.object({ id: idSchema("collection") }), async (data) => {
  const userId = getUserId();
  await runWithUser(userId, deleteCollectionFeature(userId, data.id));
  return { success: true };
});

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
