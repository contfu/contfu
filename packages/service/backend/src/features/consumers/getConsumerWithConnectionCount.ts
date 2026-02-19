import { db } from "../../infra/db/db";
import { connectionTable, consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { BackendConsumer, BackendConsumerWithConnectionCount } from "../../domain/types";

function mapToBackendConsumer(consumer: Consumer): BackendConsumer {
  return {
    id: consumer.id,
    userId: consumer.userId,
    name: consumer.name,
    includeRef: consumer.includeRef,
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
 * Get a single consumer by ID with connection count.
 * Returns undefined if not found or not owned by the user.
 */
export async function getConsumerWithConnectionCount(
  userId: number,
  id: number,
): Promise<BackendConsumerWithConnectionCount | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
    .limit(1);

  if (!consumer) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(eq(connectionTable.consumerId, id));

  return mapToBackendConsumerWithConnectionCount(consumer, countResult?.count ?? 0);
}
