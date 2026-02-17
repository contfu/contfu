import { form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import type { BackendConnectionWithDetails } from "@contfu/svc-backend/domain/types";
import { createConnection as createConnectionFeature } from "@contfu/svc-backend/features/connections/createConnection";
import { deleteConnection as deleteConnectionFeature } from "@contfu/svc-backend/features/connections/deleteConnection";
import { getConnection as getConnectionFeature } from "@contfu/svc-backend/features/connections/getConnection";
import { listConnections } from "@contfu/svc-backend/features/connections/listConnections";
import { listConnectionsByCollection } from "@contfu/svc-backend/features/connections/listConnectionsByCollection";
import { listConnectionsByConsumer } from "@contfu/svc-backend/features/connections/listConnectionsByConsumer";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all connections for the current user.
 */
export const getConnections = query(async () => {
  const userId = getUserId();
  const connections = await listConnections(userId);
  return connections.map(encodeConnection);
});

/**
 * Get connections filtered by consumer ID.
 */
export const getConnectionsByConsumer = query(
  v.object({ consumerId: idSchema("consumer") }),
  async ({ consumerId }) => {
    const userId = getUserId();
    const connections = await listConnectionsByConsumer(userId, consumerId);
    return connections.map(encodeConnection);
  },
);

/**
 * Get connections filtered by collection ID.
 */
export const getConnectionsByCollection = query(
  v.object({ collectionId: idSchema("collection") }),
  async ({ collectionId }) => {
    const userId = getUserId();
    const connections = await listConnectionsByCollection(userId, collectionId);
    return connections.map(encodeConnection);
  },
);

/**
 * Add a new connection between a consumer and a collection.
 */
export const addConnection = form(
  v.object({
    consumerId: idSchema("consumer"),
    collectionId: idSchema("collection"),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Check if connection already exists
    const existing = await getConnectionFeature(userId, data.consumerId, data.collectionId);
    if (existing) {
      invalid(issue.consumerId("Connection already exists"));
    }

    // Insert the new connection
    const connection = await createConnectionFeature(userId, {
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
    consumerId: idSchema("consumer"),
    collectionId: idSchema("collection"),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const deleted = await deleteConnectionFeature(userId, data.consumerId, data.collectionId);

    if (!deleted) {
      invalid(issue.consumerId("Connection not found"));
    }

    return { success: true };
  },
);

// =============================================================================
// Helpers
// =============================================================================

function encodeConnection(c: BackendConnectionWithDetails) {
  return {
    ...c,
    userId: encodeId("user", c.userId),
    consumerId: encodeId("consumer", c.consumerId),
    collectionId: encodeId("collection", c.collectionId),
  };
}
