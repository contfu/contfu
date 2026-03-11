import { Effect } from "effect";
import { eq, getTableColumns, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, connectionTable, flowTable } from "../../infra/db/schema";
import { mapToBackendCollection } from "./mapToBackendCollection";

/**
 * List all Collections for the current user with flow counts.
 */
export const listCollections = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const collections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            ...getTableColumns(collectionTable),
            connectionType: connectionTable.type,
            connectionName: connectionTable.name,
          })
          .from(collectionTable)
          .leftJoin(connectionTable, eq(collectionTable.connectionId, connectionTable.id))
          .orderBy(collectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const flowSourceCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: flowTable.sourceId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(flowTable)
          .groupBy(flowTable.sourceId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const flowSourceMap = new Map<number, number>(
      flowSourceCounts.map((c) => [c.collectionId, c.count]),
    );

    const flowTargetCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: flowTable.targetId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(flowTable)
          .groupBy(flowTable.targetId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const flowTargetMap = new Map<number, number>(
      flowTargetCounts.map((c) => [c.collectionId, c.count]),
    );

    return collections.map((c) =>
      mapToBackendCollection(
        c,
        flowSourceMap.get(c.id) ?? 0,
        flowTargetMap.get(c.id) ?? 0,
        c.connectionType ?? null,
        c.connectionName ?? null,
      ),
    );
  }).pipe(Effect.withSpan("collections.list"));
