import { db } from "../../infra/db/db";
import { connectionTable, consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { BackendConsumer, BackendConsumerWithConnectionCount } from "../../domain/types";

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
