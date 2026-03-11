import { Effect } from "effect";
import { eq, aliasedTable } from "drizzle-orm";
import type { BackendFlowWithDetails } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { flowTable, collectionTable, connectionTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";

/**
 * Get a single flow by ID with joined source/target collection details.
 */
export const getFlowWithDetails = (flowId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const sourceCollection = aliasedTable(collectionTable, "source_collection");
    const targetCollection = aliasedTable(collectionTable, "target_collection");
    const sourceConnection = aliasedTable(connectionTable, "source_connection");
    const targetConnection = aliasedTable(connectionTable, "target_connection");

    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: flowTable.id,
            sourceId: flowTable.sourceId,
            targetId: flowTable.targetId,
            schema: flowTable.schema,
            mappings: flowTable.mappings,
            filters: flowTable.filters,
            includeRef: flowTable.includeRef,
            createdAt: flowTable.createdAt,
            updatedAt: flowTable.updatedAt,
            sourceCollectionName: sourceCollection.name,
            sourceCollectionDisplayName: sourceCollection.displayName,
            sourceConnectionType: sourceConnection.type,
            targetCollectionName: targetCollection.name,
            targetCollectionDisplayName: targetCollection.displayName,
            targetConnectionType: targetConnection.type,
          })
          .from(flowTable)
          .innerJoin(sourceCollection, eq(flowTable.sourceId, sourceCollection.id))
          .innerJoin(targetCollection, eq(flowTable.targetId, targetCollection.id))
          .leftJoin(sourceConnection, eq(sourceCollection.connectionId, sourceConnection.id))
          .leftJoin(targetConnection, eq(targetCollection.connectionId, targetConnection.id))
          .where(eq(flowTable.id, flowId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return undefined;

    return {
      id: row.id,
      sourceId: row.sourceId,
      targetId: row.targetId,
      schema: row.schema ? unpack(row.schema) : null,
      mappings: row.mappings ? unpack(row.mappings) : null,
      filters: row.filters ? unpack(row.filters) : null,
      includeRef: row.includeRef,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      sourceCollectionName: row.sourceCollectionName,
      sourceCollectionDisplayName: row.sourceCollectionDisplayName,
      sourceConnectionType: row.sourceConnectionType,
      targetCollectionName: row.targetCollectionName,
      targetCollectionDisplayName: row.targetCollectionDisplayName,
      targetConnectionType: row.targetConnectionType,
    } satisfies BackendFlowWithDetails;
  }).pipe(Effect.withSpan("flows.getWithDetails", { attributes: { flowId } }));
