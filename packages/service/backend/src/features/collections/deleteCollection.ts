import { Effect } from "effect";
import { count, eq, or } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, flowTable } from "../../infra/db/schema";
import { publishCountDelta } from "../../infra/cache/quota-cache";

/**
 * Delete a Collection.
 * This will cascade delete all mappings and connections.
 */
export const deleteCollection = (collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [flowCountRow] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ c: count() })
          .from(flowTable)
          .where(or(eq(flowTable.sourceId, collectionId), eq(flowTable.targetId, collectionId))),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const result = yield* Effect.tryPromise({
      try: () => db.delete(collectionTable).where(eq(collectionTable.id, collectionId)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const deleted = result.length > 0;
    if (deleted) {
      yield* Effect.sync(() =>
        publishCountDelta(result[0].userId, { collections: -1, flows: -(flowCountRow?.c ?? 0) }),
      );
    }

    return deleted;
  }).pipe(Effect.withSpan("collections.delete", { attributes: { collectionId } }));
