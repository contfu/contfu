import { Effect } from "effect";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, connectionTable, flowTable } from "../../infra/db/schema";
import { mapToBackendCollection } from "./mapToBackendCollection";

/**
 * Get a single Collection by ID with flow counts.
 */
export const getCollection = (collectionId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            ...getTableColumns(collectionTable),
            connectionType: connectionTable.type,
            connectionName: connectionTable.name,
          })
          .from(collectionTable)
          .leftJoin(connectionTable, eq(collectionTable.connectionId, connectionTable.id))
          .where(eq(collectionTable.id, collectionId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection) return null;

    const [sourceCount] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(flowTable)
          .where(eq(flowTable.sourceId, collectionId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const [targetCount] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(flowTable)
          .where(eq(flowTable.targetId, collectionId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return mapToBackendCollection(
      collection,
      sourceCount?.count ?? 0,
      targetCount?.count ?? 0,
      collection.connectionType ?? null,
      collection.connectionName ?? null,
    );
  }).pipe(Effect.withSpan("collections.get", { attributes: { collectionId } }));
