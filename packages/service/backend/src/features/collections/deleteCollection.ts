import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";

/**
 * Delete a Collection.
 * This will cascade delete all mappings and connections.
 */
export const deleteCollection = (userId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(collectionTable)
          .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("collections.delete", { attributes: { userId, collectionId } }));
