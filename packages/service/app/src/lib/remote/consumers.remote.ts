import { form, query } from "$app/server";
import { getUserId } from "$lib/server/auth/user";
import {
  deleteConsumer as deleteConsumerDb,
  insertConsumer,
  selectConsumers,
  selectConsumerWithConnectionCount,
  updateConsumer as updateConsumerDb,
  type ConsumerWithConnectionCount,
} from "$lib/server/consumers/consumer-datasource";
import { invalid, redirect } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Generate a random API key as a hex string.
 */
function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("hex");
}

/**
 * Get all consumers for the current user.
 */
export const getConsumers = query(async (): Promise<ConsumerWithConnectionCount[]> => {
  const userId = getUserId();
  return selectConsumers(userId);
});

/**
 * Get a single consumer by ID.
 */
export const getConsumer = query(
  v.object({ id: v.number() }),
  async ({ id }): Promise<ConsumerWithConnectionCount | null> => {
    const userId = getUserId();
    const consumer = await selectConsumerWithConnectionCount(userId, id);
    return consumer ?? null;
  },
);

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
    const consumer = await insertConsumer(userId, {
      name: data.name,
      key: Buffer.from(apiKey, "hex"),
    });

    throw redirect(302, `/clients/${consumer.id}`);
  },
);

/**
 * Update an existing consumer.
 */
export const updateConsumer = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
    name: v.optional(v.pipe(v.string(), v.nonEmpty("Name cannot be empty"))),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Verify consumer exists
    const existing = await selectConsumerWithConnectionCount(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Consumer not found"));
    }

    // Build update object
    const updates: { name?: string } = {};
    if (data.name !== undefined) {
      updates.name = data.name;
    }

    await updateConsumerDb(userId, data.id, updates);
    return { success: true };
  },
);

/**
 * Regenerate the API key for a consumer.
 */
export const regenerateKey = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();

    // Verify consumer exists
    const existing = await selectConsumerWithConnectionCount(userId, data.id);
    if (!existing) {
      throw invalid(issue.id("Consumer not found"));
    }

    // Generate a new API key
    const apiKey = generateApiKey();

    await updateConsumerDb(userId, data.id, {
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
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.number(),
    ),
  }),
  async (data, issue) => {
    const userId = getUserId();
    const deleted = await deleteConsumerDb(userId, data.id);

    if (!deleted) {
      throw invalid(issue.id("Consumer not found"));
    }

    throw redirect(302, "/clients");
  },
);
