import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { consumerCollectionTable } from "../../infra/db/schema";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Delete all consumer-collection joins for a collection.
 */
export const disconnectAllConsumersFromCollection = (userId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(consumerCollectionTable)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              eq(consumerCollectionTable.collectionId, collectionId),
            ),
          )
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length;
  }).pipe(
    Effect.withSpan("collections.disconnectAllConsumersFromCollection", { attributes: { userId } }),
  );
