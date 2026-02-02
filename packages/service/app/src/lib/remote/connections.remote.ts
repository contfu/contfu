import { form, query } from "$app/server";
import { getUserId } from "$lib/server/auth/user";
import { createConnection as createConnectionDb } from "@contfu/svc-backend/features/connections/createConnection";
import { listConnections, listConnectionsByConsumer, listConnectionsByCollection } from "@contfu/svc-backend/features/connections/listConnections";
import { getConnection as getConnectionDb } from "@contfu/svc-backend/features/connections/getConnection";
import { deleteConnection as deleteConnectionDb } from "@contfu/svc-backend/features/connections/deleteConnection";
import type { BackendConnectionWithDetails } from "@contfu/svc-backend/domain/types";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all connections for the current user.
 */
export const getConnections = query(async (): Promise<BackendConnectionWithDetails[]> => {
  const userId = getUserId();
  return listConnections(userId);
});

/**
 * Get connections filtered by consumer ID.
 */
export const getConnectionsByConsumer = query(
  v.object({ consumerId: v.number() }),
  async ({ consumerId }): Promise<BackendConnectionWithDetails[]> => {
    const userId = getUserId();
    return listConnectionsByConsumer(userId, consumerId);
  },
);

/**
 * Get connections filtered by collection ID.
 */
export const getConnectionsByCollection = query(
  v.object({ collectionId: v.number() }),
  async ({ collectionId }): Promise<BackendConnectionWithDetails[]> => {
    const userId = getUserId();
    return listConnectionsByCollection(userId, collectionId);
  },
);

/**
 * Add a new connection between a consumer and a collection.
 */
export const addConnection = form(
  v.object({
    consumerId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    collectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Check if connection already exists
    const existing = await getConnectionDb(userId, data.consumerId, data.collectionId);
    if (existing) {
      throw invalid(issue.consumerId("Connection already exists"));
    }

    // Insert the new connection
    const connection = await createConnectionDb(userId, {
      consumerId: data.consumerId,
      collectionId: data.collectionId,
    });

    return { success: true, connection };
  },
);

/**
 * Remove a connection between a consumer and a collection.
 */
export const removeConnection = form(
  v.object({
    consumerId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    collectionId: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const deleted = await deleteConnectionDb(userId, data.consumerId, data.collectionId);

    if (!deleted) {
      throw invalid(issue.consumerId("Connection not found"));
    }

    return { success: true };
  },
);
