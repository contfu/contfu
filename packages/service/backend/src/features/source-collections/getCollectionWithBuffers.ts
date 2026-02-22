import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { sourceCollectionTable } from "../../infra/db/schema";

/**
 * Get a collection with raw ref and itemIds buffers.
 * INTERNAL USE ONLY - for sync workers that need the actual buffer data.
 */
export const getCollectionWithBuffers = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceCollectionTable)
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return collection;
  }).pipe(Effect.withSpan("sourceCollections.getWithBuffers", { attributes: { userId } }));
