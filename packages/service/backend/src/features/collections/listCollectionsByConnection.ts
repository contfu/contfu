import { eq, getColumns, sql } from "drizzle-orm";
import { Effect } from "effect";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { collectionTable } from "../../infra/db/schema";
import { mapToBackendCollection } from "./mapToBackendCollection";

/**
 * List all Collections filtered by connectionId, with flow counts via subqueries.
 */
export const listCollectionsByConnection = (connectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            ...getColumns(collectionTable),
            flowSourceCount: sql<number>`(
              SELECT count(*) FROM flow WHERE flow."sourceId" = ${collectionTable.id}
            )`.as("flowSourceCount"),
            flowTargetCount: sql<number>`(
              SELECT count(*) FROM flow WHERE flow."targetId" = ${collectionTable.id}
            )`.as("flowTargetCount"),
          })
          .from(collectionTable)
          .where(eq(collectionTable.connectionId, connectionId))
          .orderBy(collectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return rows.map((c) => mapToBackendCollection(c, c.flowSourceCount, c.flowTargetCount));
  }).pipe(Effect.withSpan("collections.listByConnection", { attributes: { connectionId } }));
