import { Effect } from "effect";
import { and, eq, sql } from "drizzle-orm";
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
 * Get a single consumer by ID with connection count.
 * Returns undefined if not found or not owned by the user.
 */
export const getConsumerWithConnectionCount = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [consumer] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(consumerTable)
          .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!consumer) return undefined;

    const [countResult] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(connectionTable)
          .where(eq(connectionTable.consumerId, id)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return mapToBackendConsumerWithConnectionCount(consumer, countResult?.count ?? 0);
  }).pipe(
    Effect.withSpan("consumers.getWithConnectionCount", { attributes: { userId, consumerId: id } }),
  );
