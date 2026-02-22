import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import type { BackendConsumer, UpdateConsumerInput } from "../../domain/types";
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
 * Update a consumer.
 * Returns undefined if not found or not owned by the user.
 */
export const updateConsumer = (userId: number, id: number, input: UpdateConsumerInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(consumerTable)
          .set(input)
          .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendConsumer(updated);
  }).pipe(Effect.withSpan("consumers.update", { attributes: { userId, consumerId: id } }));
