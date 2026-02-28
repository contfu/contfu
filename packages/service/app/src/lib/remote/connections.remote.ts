import { form, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getStreamServer } from "$lib/server/startup";
import { getUserId } from "$lib/server/user";
import { EventType, type WireEvent } from "@contfu/core";
import type { BackendConnectionWithDetails } from "@contfu/svc-backend/domain/types";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { createConnection as createConnectionFeature } from "@contfu/svc-backend/features/connections/createConnection";
import { deleteConnection as deleteConnectionFeature } from "@contfu/svc-backend/features/connections/deleteConnection";
import { getConnection as getConnectionFeature } from "@contfu/svc-backend/features/connections/getConnection";
import { listConnections } from "@contfu/svc-backend/features/connections/listConnections";
import { listConnectionsByCollection } from "@contfu/svc-backend/features/connections/listConnectionsByCollection";
import { listConnectionsByConsumer } from "@contfu/svc-backend/features/connections/listConnectionsByConsumer";
import { updateConnection as updateConnectionFeature } from "@contfu/svc-backend/features/connections/updateConnection";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all connections for the current user.
 */
export const getConnections = query(async () => {
  const userId = getUserId();
  const connections = await runWithUser(userId, listConnections(userId));
  return connections.map(encodeConnection);
});

/**
 * Get connections filtered by consumer ID.
 */
export const getConnectionsByConsumer = query(
  v.object({ consumerId: idSchema("consumer") }),
  async ({ consumerId }) => {
    const userId = getUserId();
    const connections = await runWithUser(userId, listConnectionsByConsumer(userId, consumerId));
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
    const connections = await runWithUser(
      userId,
      listConnectionsByCollection(userId, collectionId),
    );
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
    includeRef: v.optional(
      v.pipe(
        v.union([v.string(), v.boolean()]),
        v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
      ),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Check if connection already exists
    const existing = await runWithUser(
      userId,
      getConnectionFeature(userId, data.consumerId, data.collectionId),
    );
    if (existing) {
      invalid(issue.consumerId("Connection already exists"));
    }

    // Insert the new connection
    const connection = await runWithUser(
      userId,
      createConnectionFeature(userId, {
        consumerId: data.consumerId,
        collectionId: data.collectionId,
        includeRef: data.includeRef ?? true,
      }),
    );

    // Send COLLECTION_SCHEMA to the consumer so its existing SSE stream
    // learns about the newly-connected collection immediately.
    const collection = await runWithUser(
      userId,
      getCollectionFeature(userId, data.collectionId),
    );
    if (collection) {
      const schemaEvent: WireEvent = [
        EventType.COLLECTION_SCHEMA,
        collection.name,
        collection.displayName,
        {},
      ];
      getStreamServer().sendToConsumer(userId, data.consumerId, schemaEvent);
    }

    return { success: true, connection };
  },
);

/**
 * Update connection-level ref transmission policy.
 */
export const updateConnectionIncludeRef = form(
  v.object({
    consumerId: idSchema("consumer"),
    collectionId: idSchema("collection"),
    includeRef: v.pipe(
      v.union([v.string(), v.boolean()]),
      v.transform((val) => (typeof val === "boolean" ? val : val === "true")),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const updated = await runWithUser(
      userId,
      updateConnectionFeature(userId, data.consumerId, data.collectionId, {
        includeRef: data.includeRef,
      }),
    );

    if (!updated) {
      invalid(issue.consumerId("Connection not found"));
    }

    return { success: true };
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

    // Fetch collection name before deleting the connection
    const collection = await runWithUser(userId, getCollectionFeature(userId, data.collectionId));

    const deleted = await runWithUser(
      userId,
      deleteConnectionFeature(userId, data.consumerId, data.collectionId),
    );

    if (!deleted) {
      invalid(issue.consumerId("Connection not found"));
    }

    // Unicast COLLECTION_REMOVED to the disconnected consumer
    if (collection) {
      const removedEvent: WireEvent = [EventType.COLLECTION_REMOVED, collection.name];
      getStreamServer().sendToConsumer(userId, data.consumerId, removedEvent);
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
