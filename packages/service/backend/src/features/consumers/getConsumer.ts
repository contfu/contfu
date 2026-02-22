import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import type { BackendConsumer } from "../../domain/types";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerTable, type Consumer } from "../../infra/db/schema";

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

/**
 * Get a single consumer by ID.
 * Returns undefined if not found or not owned by the user.
 */
export const getConsumer = (userId: number, id: number) =>
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

    return mapToBackendConsumer(consumer);
  }).pipe(Effect.withSpan("consumers.get", { attributes: { userId, consumerId: id } }));
