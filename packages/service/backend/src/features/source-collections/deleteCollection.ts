import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { sourceCollectionTable } from "../../infra/db/schema";

/**
 * Delete a collection. Connections will cascade delete.
 */
export const deleteCollection = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(sourceCollectionTable)
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("sourceCollections.delete", { attributes: { userId } }));
