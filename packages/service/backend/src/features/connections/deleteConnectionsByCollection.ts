import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { connectionTable } from "../../infra/db/schema";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Delete all connections for a collection.
 */
export const deleteConnectionsByCollection = (userId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(connectionTable)
          .where(
            and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)),
          )
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length;
  }).pipe(Effect.withSpan("connections.deleteByCollection", { attributes: { userId } }));
