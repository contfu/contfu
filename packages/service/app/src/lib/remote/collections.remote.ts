import { form, query } from "$app/server";
import { getUserId } from "$lib/server/auth/user";
import {
  deleteCollection as deleteCollectionDb,
  listCollectionSummariesBySource,
  insertCollection,
  selectCollection,
  selectCollections,
  selectCollectionWithConnectionCount,
  updateCollection as updateCollectionDb,
  type CollectionWithConnectionCount,
  type CollectionSummary,
} from "$lib/server/collections/collection-datasource";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all collections for the current user.
 */
export const getCollections = query(async (): Promise<CollectionWithConnectionCount[]> => {
  const userId = getUserId();
  return selectCollections(userId);
});

/**
 * Get collections filtered by source ID (minimal summary data).
 */
export const getCollectionsBySource = query(
  v.object({ sourceId: v.number() }),
  async ({ sourceId }): Promise<CollectionSummary[]> => {
    console.log("Getting collections by sourceId", sourceId);
    const userId = getUserId();
    return listCollectionSummariesBySource(userId, sourceId);
  },
);

/**
 * Get a single collection by ID.
 */
export const getCollection = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<CollectionWithConnectionCount | null> => {
    const userId = getUserId();
    const collection = await selectCollectionWithConnectionCount(userId, id);
    return collection ?? null;
  },
);

/**
 * Create a new collection.
 */
export const createCollection = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
    sourceId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    ref: v.optional(v.string()),
  }),
  async (data) => {
    const userId = getUserId();

    // Insert into database
    const collection = await insertCollection(userId, {
      name: data.name,
      sourceId: data.sourceId,
      ref: data.ref ? Buffer.from(data.ref, "utf-8") : null,
    });

    throw redirect(302, `/sources/${collection.sourceId}/collections/${collection.id}`);
  },
);

/**
 * Update an existing collection.
 */
export const updateCollection = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    name: v.optional(v.pipe(v.string(), v.nonEmpty("Name cannot be empty"))),
    ref: v.optional(v.string()),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Verify collection exists
    const existing = await selectCollection(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Collection not found"));
    }

    // Build update object
    const updates: { name?: string; ref?: Buffer | null } = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.ref !== undefined) {
      updates.ref = data.ref.length > 0 ? Buffer.from(data.ref, "utf-8") : null;
    }

    await updateCollectionDb(userId, data.id, updates);
    return { success: true };
  },
);

/**
 * Delete a collection.
 */
export const deleteCollection = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Get collection to find sourceId before deleting
    const existing = await selectCollection(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Collection not found"));
    }
    const sourceId = existing.sourceId;

    const deleted = await deleteCollectionDb(userId, data.id);
    if (!deleted) {
      throw invalid(issue.id("Collection not found"));
    }

    throw redirect(302, `/sources/${sourceId}/collections`);
  },
);
