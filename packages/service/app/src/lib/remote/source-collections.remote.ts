import { form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import { createCollection as createCollectionFeature } from "@contfu/svc-backend/features/source-collections/createCollection";
import { listCollections } from "@contfu/svc-backend/features/source-collections/listCollections";
import { listCollectionSummariesBySource } from "@contfu/svc-backend/features/source-collections/listCollectionSummariesBySource";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/source-collections/getCollection";
import { getCollectionWithConnectionCount } from "@contfu/svc-backend/features/source-collections/getCollectionWithConnectionCount";
import { updateCollection as updateCollectionFeature } from "@contfu/svc-backend/features/source-collections/updateCollection";
import { deleteCollection as deleteCollectionFeature } from "@contfu/svc-backend/features/source-collections/deleteCollection";
import type {
  BackendCollectionWithConnectionCount,
  BackendCollectionSummary,
} from "@contfu/svc-backend/domain/types";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all source collections for the current user.
 */
export const getSourceCollections = query(
  async (): Promise<BackendCollectionWithConnectionCount[]> => {
    const userId = getUserId();
    return listCollections(userId);
  },
);

/**
 * Get source collections filtered by source ID (minimal summary data).
 */
export const getSourceCollectionsBySource = query(
  v.object({ sourceId: v.number() }),
  async ({ sourceId }): Promise<BackendCollectionSummary[]> => {
    console.log("Getting source collections by sourceId", sourceId);
    const userId = getUserId();
    return listCollectionSummariesBySource(userId, sourceId);
  },
);

/**
 * Get a single source collection by ID.
 */
export const getSourceCollection = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<BackendCollectionWithConnectionCount | null> => {
    const userId = getUserId();
    const collection = await getCollectionWithConnectionCount(userId, id);
    return collection ?? null;
  },
);

/**
 * Create a new source collection.
 */
export const createSourceCollection = form(
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
    const collection = await createCollectionFeature(userId, {
      name: data.name,
      sourceId: data.sourceId,
      ref: data.ref ? Buffer.from(data.ref, "utf-8") : null,
    });

    throw redirect(302, `/sources/${collection.sourceId}/collections/${collection.id}`);
  },
);

/**
 * Update an existing source collection.
 */
export const updateSourceCollection = form(
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
    const existing = await getCollectionFeature(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Source collection not found"));
    }

    // Build update object
    const updates: { name?: string; ref?: Buffer | null } = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }
    if (data.ref !== undefined) {
      updates.ref = data.ref.length > 0 ? Buffer.from(data.ref, "utf-8") : null;
    }

    await updateCollectionFeature(userId, data.id, updates);
    return { success: true };
  },
);

/**
 * Delete a source collection.
 */
export const deleteSourceCollection = form(
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
    const existing = await getCollectionFeature(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Source collection not found"));
    }
    const sourceId = existing.sourceId;

    const deleted = await deleteCollectionFeature(userId, data.id);
    if (!deleted) {
      throw invalid(issue.id("Source collection not found"));
    }

    throw redirect(302, `/sources/${sourceId}/collections`);
  },
);
