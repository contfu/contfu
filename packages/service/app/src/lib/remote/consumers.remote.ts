import { form, query } from "$app/server";
import { getUserId } from "$lib/server/user";
import type { BackendConsumerWithConnectionCount } from "@contfu/svc-backend/domain/types";
import { createConsumer as createConsumerFeature } from "@contfu/svc-backend/features/consumers/createConsumer";
import { deleteConsumer as deleteConsumerFeature } from "@contfu/svc-backend/features/consumers/deleteConsumer";
import { getConsumer as getConsumerFeature } from "@contfu/svc-backend/features/consumers/getConsumer";
import { getConsumerWithConnectionCount } from "@contfu/svc-backend/features/consumers/getConsumerWithConnectionCount";
import { listConsumers } from "@contfu/svc-backend/features/consumers/listConsumers";
import { updateConsumer as updateConsumerFeature } from "@contfu/svc-backend/features/consumers/updateConsumer";
import { encodeId, idSchema } from "@contfu/svc-backend/infra/ids";
import { error, invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";
import { getStreamServer } from "$lib/server/startup";

/**
 * Generate a random API key as a hex string.
 */
function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("hex");
}

function encodeConsumer(c: BackendConsumerWithConnectionCount) {
  const streamServer = getStreamServer();
  return {
    ...c,
    id: encodeId("consumer", c.id),
    userId: encodeId("user", c.userId),
    isActive: streamServer.isConsumerActive(c.userId, c.id),
  };
}

/**
 * Get all consumers for the current user.
 */
export const getConsumers = query(async () => {
  const userId = getUserId();
  const consumers = await listConsumers(userId);
  return consumers.map(encodeConsumer);
});

/**
 * Get a single consumer by ID.
 */
export const getConsumer = query(v.object({ id: idSchema("consumer") }), async ({ id }) => {
  const userId = getUserId();
  const consumer = await getConsumerWithConnectionCount(userId, id);
  if (!consumer) error(404, "Consumer not found");
  return encodeConsumer(consumer);
});

/**
 * Create a new consumer with an auto-generated API key.
 */
export const createConsumer = form(
  v.object({
    name: v.pipe(v.string(), v.nonEmpty("Name is required")),
  }),
  async (data) => {
    const userId = getUserId();

    // Generate a new API key
    const apiKey = generateApiKey();

    // Insert into database
    const consumer = await createConsumerFeature(userId, {
      name: data.name,
      key: Buffer.from(apiKey, "hex"),
    });

    redirect(303, `/consumers/${encodeId("consumer", consumer.id)}`);
  },
);

/**
 * Update an existing consumer.
 */
export const updateConsumer = form(
  v.object({
    id: idSchema("consumer"),
    name: v.optional(v.pipe(v.string(), v.nonEmpty("Name cannot be empty"))),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Verify consumer exists
    const existing = await getConsumerFeature(userId, data.id);
    if (!existing) {
      invalid(issue.id("Consumer not found"));
    }

    // Build update object
    const updates: { name?: string } = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }

    await updateConsumerFeature(userId, data.id, updates);
    return { success: true };
  },
);

/**
 * Regenerate the API key for a consumer.
 */
export const regenerateKey = form(
  v.object({
    id: idSchema("consumer"),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Verify consumer exists
    const existing = await getConsumerFeature(userId, data.id);
    if (!existing) {
      invalid(issue.id("Consumer not found"));
    }

    // Generate a new API key
    const apiKey = generateApiKey();

    await updateConsumerFeature(userId, data.id, {
      key: Buffer.from(apiKey, "hex"),
    });

    return { success: true, key: apiKey };
  },
);

/**
 * Delete a consumer.
 */
export const deleteConsumer = form(
  v.object({
    id: idSchema("consumer"),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const deleted = await deleteConsumerFeature(userId, data.id);

    if (!deleted) {
      invalid(issue.id("Consumer not found"));
    }

    return { success: true };
  },
);
