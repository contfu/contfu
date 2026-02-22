import { Effect } from "effect";
import { eq, inArray, sql } from "drizzle-orm";
import type { BackendConsumer, BackendConsumerWithConnectionCount } from "../../domain/types";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { connectionTable, consumerTable, type Consumer } from "../../infra/db/schema";

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
 * Get all consumers for a user with connection counts.
 */
export const listConsumers = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const consumers = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(consumerTable)
          .where(eq(consumerTable.userId, userId))
          .orderBy(consumerTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (consumers.length === 0) return [];

    const consumerIds = consumers.map((c) => c.id);
    const connectionCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            consumerId: connectionTable.consumerId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(connectionTable)
          .where(inArray(connectionTable.consumerId, consumerIds))
          .groupBy(connectionTable.consumerId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const countMap = new Map<number, number>(connectionCounts.map((c) => [c.consumerId, c.count]));

    return consumers.map((consumer) =>
      mapToBackendConsumerWithConnectionCount(consumer, countMap.get(consumer.id) ?? 0),
    );
  }).pipe(Effect.withSpan("consumers.list", { attributes: { userId } }));
