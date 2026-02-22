import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerTable } from "../../infra/db/schema";

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

    return result.length > 0;
  }).pipe(Effect.withSpan("consumers.delete", { attributes: { userId, consumerId: id } }));
