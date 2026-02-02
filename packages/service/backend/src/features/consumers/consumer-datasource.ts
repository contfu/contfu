import { db } from "../../infra/db/db";
import { connectionTable, consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type {
  BackendConsumer,
  BackendConsumerWithConnectionCount,
  CreateConsumerInput,
  UpdateConsumerInput,
} from "../../domain/types";

// =============================================================================
// Mappers (DB → Domain)
// =============================================================================

function mapToBackendConsumer(consumer: Consumer): BackendConsumer {
  return {
    id: consumer.id,
    userId: consumer.userId,
    name: consumer.name,
    hasKey: consumer.key !== null,
    createdAt: consumer.createdAt,
  };
}

function mapToBackendConsumerWithConnectionCount(
  consumer: Consumer,
  connectionCount: number,
): BackendConsumerWithConnectionCount {
  return {
    ...mapToBackendConsumer(consumer),
    connectionCount,
  };
}

// =============================================================================
// Public Feature Functions (return domain types)
// =============================================================================

/**
 * Create a new consumer for a user.
 * The ID is auto-generated as max(id) + 1 within the user's consumers.
 */
export async function createConsumer(
  userId: number,
  input: CreateConsumerInput,
): Promise<BackendConsumer> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(consumerTable)
    .where(eq(consumerTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(consumerTable)
    .values({
      userId,
      id: nextId,
      name: input.name,
      key: input.key ?? null,
    })
    .returning();

  return mapToBackendConsumer(inserted);
}

/**
 * Get all consumers for a user with connection counts.
 */
export async function listConsumers(
  userId: number,
): Promise<BackendConsumerWithConnectionCount[]> {
  const consumers = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.userId, userId))
    .orderBy(consumerTable.createdAt);

  const connectionCounts = await db
    .select({
      consumerId: connectionTable.consumerId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(eq(connectionTable.userId, userId))
    .groupBy(connectionTable.consumerId);

  const countMap = new Map<number, number>(
    connectionCounts.map((c) => [c.consumerId, c.count]),
  );

  return consumers.map((consumer) =>
    mapToBackendConsumerWithConnectionCount(consumer, countMap.get(consumer.id) ?? 0),
  );
}

/**
 * Get a single consumer by ID.
 */
export async function getConsumer(
  userId: number,
  id: number,
): Promise<BackendConsumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .limit(1);

  if (!consumer) return undefined;

  return mapToBackendConsumer(consumer);
}

/**
 * Get a single consumer by ID with connection count.
 */
export async function getConsumerWithConnectionCount(
  userId: number,
  id: number,
): Promise<BackendConsumerWithConnectionCount | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .limit(1);

  if (!consumer) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, id)));

  return mapToBackendConsumerWithConnectionCount(consumer, countResult?.count ?? 0);
}

/**
 * Update a consumer.
 */
export async function updateConsumer(
  userId: number,
  id: number,
  input: UpdateConsumerInput,
): Promise<BackendConsumer | undefined> {
  const [updated] = await db
    .update(consumerTable)
    .set(input)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendConsumer(updated);
}

/**
 * Delete a consumer. Connections will cascade delete.
 */
export async function deleteConsumer(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  return result.length > 0;
}

// =============================================================================
// Internal Functions (with raw key - for internal backend use only)
// =============================================================================

/**
 * Get a consumer with raw API key buffer.
 * INTERNAL USE ONLY - for API authentication that needs the actual key.
 */
export async function getConsumerWithKey(
  userId: number,
  id: number,
): Promise<Consumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .limit(1);

  return consumer;
}

/**
 * Find a consumer by API key.
 * INTERNAL USE ONLY - for API authentication.
 */
export async function findConsumerByKey(key: Buffer): Promise<Consumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1);

  return consumer;
}

// =============================================================================
// Legacy exports (deprecated - use new function names)
// =============================================================================

/** @deprecated Use createConsumer instead */
export const insertConsumer = createConsumer;

/** @deprecated Use listConsumers instead */
export const selectConsumers = listConsumers;

/** @deprecated Use getConsumer instead */
export const selectConsumer = getConsumer;

/** @deprecated Use getConsumerWithConnectionCount instead */
export const selectConsumerWithConnectionCount = getConsumerWithConnectionCount;

// Re-export types for convenience
export type {
  BackendConsumer,
  BackendConsumerWithConnectionCount,
} from "../../domain/types";

// Legacy type aliases for backwards compatibility
export type NewConsumer = CreateConsumerInput;
export type ConsumerUpdate = UpdateConsumerInput;
export type ConsumerWithConnectionCount = BackendConsumerWithConnectionCount;
