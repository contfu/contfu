import { form, query } from "$app/server";
import { runWithUser } from "$lib/server/run";
import { getStreamServer } from "$lib/server/startup";
import { getUserId } from "$lib/server/user";
import { EventType, type WireEvent } from "@contfu/core";
import type { BackendConsumerCollectionWithDetails } from "@contfu/svc-backend/domain/types";
import { getCollection as getCollectionFeature } from "@contfu/svc-backend/features/collections/getCollection";
import { connectCollectionToConsumer as connectCollectionToConsumerFeature } from "@contfu/svc-backend/features/consumers/connectCollectionToConsumer";
import { disconnectCollectionFromConsumer as disconnectCollectionFromConsumerFeature } from "@contfu/svc-backend/features/consumers/disconnectCollectionFromConsumer";
import { getConsumerCollection as getConsumerCollectionFeature } from "@contfu/svc-backend/features/consumers/getConsumerCollection";
import { listConsumerCollections } from "@contfu/svc-backend/features/consumers/listConsumerCollections";
import { listConsumerCollectionsByCollection } from "@contfu/svc-backend/features/collections/listConsumerCollectionsByCollection";
import { listConsumerCollectionsByConsumer } from "@contfu/svc-backend/features/consumers/listConsumerCollectionsByConsumer";
import { updateConsumerCollection as updateConsumerCollectionFeature } from "@contfu/svc-backend/features/consumers/updateConsumerCollection";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Get all consumer-collection joins for the current user.
 */
export const getConsumerCollections = query(async () => {
  const userId = getUserId();
  const rows = await runWithUser(userId, listConsumerCollections(userId));
  return rows.map(encodeConsumerCollection);
});

/**
 * Get consumer-collection joins filtered by consumer ID.
 */
export const getConsumerCollectionsByConsumer = query(
  v.object({ consumerId: idSchema("consumer") }),
  async ({ consumerId }) => {
    const userId = getUserId();
    const rows = await runWithUser(userId, listConsumerCollectionsByConsumer(userId, consumerId));
    return rows.map(encodeConsumerCollection);
  },
);

/**
 * Get consumer-collection joins filtered by collection ID.
 */
export const getConsumerCollectionsByCollection = query(
  v.object({ collectionId: idSchema("collection") }),
  async ({ collectionId }) => {
    const userId = getUserId();
    const rows = await runWithUser(
      userId,
      listConsumerCollectionsByCollection(userId, collectionId),
    );
    return rows.map(encodeConsumerCollection);
  },
);

/**
 * Add a new consumer-collection join.
 */
export const addConsumerCollection = form(
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

    // Check if join already exists
    const existing = await runWithUser(
      userId,
      getConsumerCollectionFeature(userId, data.consumerId, data.collectionId),
    );
    if (existing) {
      invalid(issue.consumerId("Connection already exists"));
    }

    // Insert the new join
    const cc = await runWithUser(
      userId,
      connectCollectionToConsumerFeature(userId, {
        consumerId: data.consumerId,
        collectionId: data.collectionId,
        includeRef: data.includeRef ?? true,
      }),
    );

    // Send COLLECTION_SCHEMA to the consumer so its existing SSE stream
    // learns about the newly-connected collection immediately.
    const collection = await runWithUser(userId, getCollectionFeature(userId, data.collectionId));
    if (collection) {
      const schemaEvent: WireEvent = [
        EventType.COLLECTION_SCHEMA,
        collection.name,
        collection.displayName,
        collection.schema,
      ];
      getStreamServer().sendToConsumer(userId, data.consumerId, schemaEvent);
    }

    return { success: true, connection: cc };
  },
);

/**
 * Update consumer-collection ref transmission policy.
 */
export const updateConsumerCollectionIncludeRef = form(
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
      updateConsumerCollectionFeature(userId, data.consumerId, data.collectionId, {
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
 * Remove a consumer-collection join.
 */
export const removeConsumerCollection = form(
  v.object({
    consumerId: idSchema("consumer"),
    collectionId: idSchema("collection"),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Fetch collection name before deleting the join
    const collection = await runWithUser(userId, getCollectionFeature(userId, data.collectionId));

    const deleted = await runWithUser(
      userId,
      disconnectCollectionFromConsumerFeature(userId, data.consumerId, data.collectionId),
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

function encodeConsumerCollection(c: BackendConsumerCollectionWithDetails) {
  return {
    ...c,
    userId: encodeId("user", c.userId),
    consumerId: encodeId("consumer", c.consumerId),
    collectionId: encodeId("collection", c.collectionId),
  };
}
