import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { connectionTable } from "../../infra/db/schema";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Delete a connection.
 */
export const deleteConnection = (userId: number, consumerId: number, collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(connectionTable)
          .where(
            and(
              eq(connectionTable.userId, userId),
              eq(connectionTable.consumerId, consumerId),
              eq(connectionTable.collectionId, collectionId),
            ),
          )
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("connections.delete", { attributes: { userId } }));
