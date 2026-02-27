import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable } from "../../infra/db/schema";
import { decrementCount } from "../../infra/nats/quota-kv";

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

    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.promise(() => decrementCount(userId, "collections"));
    }

    return deleted;
  }).pipe(Effect.withSpan("collections.delete", { attributes: { userId, collectionId } }));
