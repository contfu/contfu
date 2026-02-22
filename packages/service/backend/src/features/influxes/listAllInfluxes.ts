import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { influxTable, sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/svc-core";
import type { BackendInfluxWithDetails } from "../../domain/types";

/**
 * List all influxes for a user (across all collections).
 */
export const listAllInfluxes = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: influxTable.id,
            sourceCollectionId: influxTable.sourceCollectionId,
            schema: influxTable.schema,
            filters: influxTable.filters,
            includeRef: influxTable.includeRef,
            createdAt: influxTable.createdAt,
            sourceCollectionName: sourceCollectionTable.name,
            sourceCollectionDisplayName: sourceCollectionTable.displayName,
            sourceCollectionRef: sourceCollectionTable.ref,
            sourceId: sourceCollectionTable.sourceId,
            sourceName: sourceTable.name,
            sourceType: sourceTable.type,
          })
          .from(influxTable)
          .innerJoin(
            sourceCollectionTable,
            and(
              eq(influxTable.userId, sourceCollectionTable.userId),
              eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
            ),
          )
          .innerJoin(
            sourceTable,
            and(
              eq(sourceCollectionTable.userId, sourceTable.userId),
              eq(sourceCollectionTable.sourceId, sourceTable.id),
            ),
          )
          .where(eq(influxTable.userId, userId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return results.map((r) => ({
      id: r.id,
      sourceCollectionId: r.sourceCollectionId,
      sourceCollectionName: r.sourceCollectionDisplayName || r.sourceCollectionName,
      sourceCollectionRef: r.sourceCollectionRef ? r.sourceCollectionRef.toString("utf-8") : null,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      sourceType: r.sourceType,
      schema: r.schema ? (unpack(r.schema) as CollectionSchema) : null,
      filters: r.filters ? (unpack(r.filters) as Filter[]) : null,
      includeRef: r.includeRef,
      createdAt: r.createdAt,
    })) satisfies BackendInfluxWithDetails[];
  }).pipe(Effect.withSpan("influxes.listAll", { attributes: { userId } }));
