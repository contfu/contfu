import { Effect } from "effect";
import { and, eq, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, influxTable } from "../../infra/db/schema";
import { pack } from "msgpackr";

/**
 * Delete an influx by ID.
 * If it was the last influx for its collection, clears the collection schema.
 * Returns true if deleted, false if not found.
 */
export const deleteInflux = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    // Fetch the influx first to get its collectionId
    const [influx] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ collectionId: influxTable.collectionId })
          .from(influxTable)
          .where(and(eq(influxTable.userId, userId), eq(influxTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!influx) return false;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(influxTable)
          .where(and(eq(influxTable.userId, userId), eq(influxTable.id, id)))
          .returning({ id: influxTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (result.length === 0) return false;

    // If no influxes remain for this collection, clear its schema
    const [{ count }] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(influxTable)
          .where(
            and(eq(influxTable.userId, userId), eq(influxTable.collectionId, influx.collectionId)),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (Number(count) === 0) {
      yield* Effect.tryPromise({
        try: () =>
          db
            .update(collectionTable)
            .set({ schema: pack({}), updatedAt: new Date() })
            .where(
              and(eq(collectionTable.userId, userId), eq(collectionTable.id, influx.collectionId)),
            ),
        catch: (e) => new DatabaseError({ cause: e }),
      });
    }

    return true;
  }).pipe(Effect.withSpan("influxes.delete", { attributes: { userId, id } }));
