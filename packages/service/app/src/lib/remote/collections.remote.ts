import { form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import {
  listCollections as listCollectionsFeature,
  type Collection,
} from "@contfu/svc-backend/features/collections/listCollections";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/collections/createCollection";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/collections/updateCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/collections/deleteCollection";
import {
  listSourceCollectionMappings,
  type SourceCollectionMappingWithDetails,
} from "@contfu/svc-backend/features/collections/listSourceCollectionMappings";
import { addSourceCollectionMapping } from "@contfu/svc-backend/features/collections/addSourceCollectionMapping";
import { removeSourceCollectionMapping } from "@contfu/svc-backend/features/collections/removeSourceCollectionMapping";
import { redirect, invalid } from "@sveltejs/kit";
import * as v from "valibot";

export type { Collection };

/**
 * Get all Collections for the current user.
 */
export const getCollections = query(async (): Promise<Collection[]> => {
  const userId = getUserId();
  return listCollectionsFeature(userId);
});

/**
 * Get a single Collection by ID.
 */
export const getCollection = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<Collection | null> => {
    const userId = getUserId();
    return getCollectionFeature(userId, id);
  },
);

/**
 * Create a new Collection.
 */
export const createCollection = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data) => {
    const userId = getUserId();
    const collection = await createCollectionFeature(userId, { name: data.name });
    throw redirect(302, `/collections/${collection.id}`);
  },
);

/**
 * Update a Collection.
 */
export const updateCollection = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data) => {
    const userId = getUserId();
    await updateCollectionFeature(userId, data.id, { name: data.name });
    return { success: true };
  },
);

/**
 * Delete a Collection.
 */
export const deleteCollection = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data) => {
    const userId = getUserId();
    await deleteCollectionFeature(userId, data.id);
    throw redirect(302, "/collections");
  },
);

/**
 * Get source collections linked to a Collection.
 */
export const getSourceCollectionMappings = query(
  v.object({ collectionId: v.number() }),
  async ({ collectionId }): Promise<SourceCollectionMappingWithDetails[]> => {
    const userId = getUserId();
    return listSourceCollectionMappings(userId, collectionId);
  },
);

/**
 * Add a source collection to a Collection.
 */
export const addSourceCollection = form(
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
  async (data, issue) => {
    const userId = getUserId();
    try {
      await addSourceCollectionMapping(userId, {
        collectionId: data.collectionId,
        sourceCollectionId: data.sourceCollectionId,
      });
      return { success: true };
    } catch {
      throw invalid(issue.sourceCollectionId("Source collection already linked"));
    }
  },
);

/**
 * Remove a source collection from a Collection.
 */
export const removeSourceCollection = form(
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
    await removeSourceCollectionMapping(userId, data.collectionId, data.sourceCollectionId);
    return { success: true };
  },
);
