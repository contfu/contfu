import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerTable } from "../../infra/db/schema";
import { decrementCount } from "../../infra/nats/quota-kv";

/**
 * Delete a consumer. Connections will cascade delete.
 * Returns false if not found or not owned by the user.
 */
export const deleteConsumer = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(consumerTable)
          .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.promise(() => decrementCount(userId, "consumers"));
    }

    return deleted;
  }).pipe(Effect.withSpan("consumers.delete", { attributes: { userId, consumerId: id } }));
