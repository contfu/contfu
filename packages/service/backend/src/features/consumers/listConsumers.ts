import { db } from "../../infra/db/db";
import { connectionTable, consumerTable, type Consumer } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
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
 * Get all consumers for a user with connection counts.
 */
export async function listConsumers(userId: number): Promise<BackendConsumerWithConnectionCount[]> {
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

  const countMap = new Map<number, number>(connectionCounts.map((c) => [c.consumerId, c.count]));

  return consumers.map((consumer) =>
    mapToBackendConsumerWithConnectionCount(consumer, countMap.get(consumer.id) ?? 0),
  );
}
