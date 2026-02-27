import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { sourceTable } from "../../infra/db/schema";
import { decrementCount } from "../../infra/nats/quota-kv";

/**
 * Delete a source. Collections will cascade delete.
 * Returns false if not found or not owned by the user.
 */
export const deleteSource = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(sourceTable)
          .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.promise(() => decrementCount(userId, "sources"));
    }

    return deleted;
  }).pipe(Effect.withSpan("sources.delete", { attributes: { userId, sourceId: id } }));
