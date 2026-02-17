import { form, query } from "$app/server";
import { encodeCollection } from "$lib/mappers/collection.mappers";
import { getUserId } from "$lib/server/user";
import type { CollectionSchema } from "@contfu/svc-core";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/collections/createCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/collections/deleteCollection";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { listCollections as listCollectionsFeature } from "@contfu/svc-backend/features/collections/listCollections";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
import { createInflux } from "@contfu/svc-backend/features/influxes/createInflux";
import { createCollection as createSourceCollectionFeature } from "@contfu/svc-backend/features/source-collections/createCollection";
import { getCollectionSchema } from "@contfu/svc-backend/features/source-collections/getCollectionSchema";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { error, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all Collections for the current user.
 */
export const getCollections = query(async () => {
  const userId = getUserId();
  const collections = await listCollectionsFeature(userId);
  return collections.map(encodeCollection);
});

/**
 * Get a single Collection by ID.
 */
export const getCollection = query(v.object({ id: idSchema("collection") }), async ({ id }) => {
  const userId = getUserId();
  const collection = await getCollectionFeature(userId, id);
  if (!collection) error(404, "Collection not found");
  return encodeCollection(collection);
});

/**
 * Create a new Collection.
 * Optionally create a SourceCollection and link it via an influx in one step.
 */
export const createCollection = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
    // Optional: create and link a SourceCollection in one step
    sourceId: v.optional(idSchema("source")),
    ref: v.optional(v.string()), // Content type UID, e.g., "api::article.article"
  }),
  async (data) => {
    const userId = getUserId();
    const collection = await createCollectionFeature(userId, { name: data.name });

    // If sourceId + ref provided, create SourceCollection and link it via influx
    if (data.sourceId && data.ref) {
      const sourceCollection = await createSourceCollectionFeature(userId, {
        name: data.name, // Use collection name for the source collection too
        sourceId: data.sourceId,
        ref: Buffer.from(data.ref, "utf-8"),
      });
      await createInflux(userId, {
        collectionId: collection.id,
        sourceCollectionId: sourceCollection.id,
      });
    }

    redirect(303, `/collections/${encodeId("collection", collection.id)}`);
  },
);

/**
 * Update a Collection.
 */
export const updateCollection = form(
  v.object({ id: idSchema("collection"), name: v.string() }),
  async (data) => {
    const userId = getUserId();
    await updateCollectionFeature(userId, data.id, { name: data.name });
    return { success: true };
  },
);

/**
 * Delete a Collection.
 */
export const deleteCollection = form(v.object({ id: idSchema("collection") }), async (data) => {
  const userId = getUserId();
  await deleteCollectionFeature(userId, data.id);
  return { success: true };
});

/**
 * Get the schema for a source collection.
 */
export const getSourceCollectionSchemaQuery = query(
  v.object({ sourceCollectionId: idSchema("sourceCollection") }),
  async ({ sourceCollectionId }): Promise<CollectionSchema | null> => {
    const userId = getUserId();
    return getCollectionSchema(userId, sourceCollectionId);
  },
);
