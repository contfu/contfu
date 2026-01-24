import { form, query, getRequestEvent } from "$app/server";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import {
  insertConnection,
  selectConnections,
  selectConnectionsByConsumer,
  selectConnectionsByCollection,
  selectConnection,
  deleteConnection as deleteConnectionDb,
  type ConnectionWithDetails,
} from "$lib/server/connections/connection-datasource";

function getUserId(): string {
  const event = getRequestEvent();
  const user = event.locals.user;
  if (!user) {
    throw redirect(302, "/login");
  }
  return user.id;
}

/**
 * Get all connections for the current user.
 */
export const getConnections = query(async (): Promise<ConnectionWithDetails[]> => {
  const userId = getUserId();
  return selectConnections(userId);
});

/**
 * Get connections filtered by consumer ID.
 */
export const getConnectionsByConsumer = query(
  v.object({ consumerId: v.number() }),
  async ({ consumerId }): Promise<ConnectionWithDetails[]> => {
    const userId = getUserId();
    return selectConnectionsByConsumer(userId, consumerId);
  },
);

/**
 * Get connections filtered by collection ID.
 */
export const getConnectionsByCollection = query(
  v.object({ collectionId: v.number() }),
  async ({ collectionId }): Promise<ConnectionWithDetails[]> => {
    const userId = getUserId();
    return selectConnectionsByCollection(userId, collectionId);
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
    const existing = await selectConnection(userId, data.consumerId, data.collectionId);
    if (existing) {
      throw invalid(issue.consumerId("Connection already exists"));
    }

    // Insert the new connection
    const connection = await insertConnection(userId, {
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
