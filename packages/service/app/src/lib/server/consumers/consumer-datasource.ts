import { db } from "$lib/server/db/db";
import { connectionTable, consumerTable, type Consumer } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type NewConsumer = {
  name: string;
  key?: Buffer | null;
};

export type ConsumerUpdate = {
  name?: string;
  key?: Buffer | null;
};

export type ConsumerWithConnectionCount = Consumer & {
  connectionCount: number;
};

/**
 * Insert a new consumer for a user.
 * The ID is auto-generated as max(id) + 1 within the user's consumers.
 */
export async function insertConsumer(userId: string, consumer: NewConsumer): Promise<Consumer> {
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
      name: consumer.name,
      key: consumer.key ?? null,
    })
    .returning();

  return inserted;
}

/**
 * Get all consumers for a user with connection counts.
 */
export async function selectConsumers(userId: string): Promise<ConsumerWithConnectionCount[]> {
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
    connectionCounts.map((c: { consumerId: number; count: number }) => [c.consumerId, c.count]),
  );

  return consumers.map(
    (consumer: Consumer): ConsumerWithConnectionCount => ({
      ...consumer,
      connectionCount: countMap.get(consumer.id) ?? 0,
    }),
  );
}

/**
 * Get a single consumer by ID.
 */
export async function selectConsumer(userId: string, id: number): Promise<Consumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .limit(1);

  return consumer;
}

/**
 * Get a single consumer by ID with connection count.
 */
export async function selectConsumerWithConnectionCount(
  userId: string,
  id: number,
): Promise<ConsumerWithConnectionCount | undefined> {
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

  return {
    ...consumer,
    connectionCount: countResult?.count ?? 0,
  };
}

/**
 * Update a consumer.
 */
export async function updateConsumer(
  userId: string,
  id: number,
  updates: ConsumerUpdate,
): Promise<Consumer | undefined> {
  const [updated] = await db
    .update(consumerTable)
    .set(updates)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  return updated;
}

/**
 * Delete a consumer. Connections will cascade delete.
 */
export async function deleteConsumer(userId: string, id: number): Promise<boolean> {
  const result = await db
    .delete(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  return result.length > 0;
}
