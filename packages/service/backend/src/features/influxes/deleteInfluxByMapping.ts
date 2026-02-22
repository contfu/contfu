import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { influxTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete an influx by collection and source collection IDs.
 * Returns true if deleted, false if not found.
 */
export const deleteInfluxByMapping = (
  userId: number,
  collectionId: number,
  sourceCollectionId: number,
) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(influxTable)
          .where(
            and(
              eq(influxTable.userId, userId),
              eq(influxTable.collectionId, collectionId),
              eq(influxTable.sourceCollectionId, sourceCollectionId),
            ),
          )
          .returning({ id: influxTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(
    Effect.withSpan("influxes.deleteByMapping", {
      attributes: { userId, collectionId, sourceCollectionId },
    }),
  );
