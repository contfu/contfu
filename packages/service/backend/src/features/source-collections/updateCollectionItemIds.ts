import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { sourceCollectionTable } from "../../infra/db/schema";

/**
 * Update collection's itemIds buffer directly.
 * INTERNAL USE ONLY - for sync workers.
 */
export const updateCollectionItemIds = (userId: number, id: number, itemIds: Buffer | null) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .update(sourceCollectionTable)
          .set({
            itemIds,
            updatedAt: new Date(),
          })
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .returning({ id: sourceCollectionTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("sourceCollections.updateItemIds", { attributes: { userId } }));
