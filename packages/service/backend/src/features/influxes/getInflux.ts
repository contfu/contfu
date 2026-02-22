import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { influxTable, sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { CollectionSchema, Filter } from "@contfu/svc-core";
import type { BackendInfluxDetails } from "../../domain/types";

/**
 * Get a single influx by ID with source details.
 */
export const getInflux = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [result] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: influxTable.id,
            userId: influxTable.userId,
            collectionId: influxTable.collectionId,
            sourceCollectionId: influxTable.sourceCollectionId,
            schema: influxTable.schema,
            filters: influxTable.filters,
            includeRef: influxTable.includeRef,
            createdAt: influxTable.createdAt,
            updatedAt: influxTable.updatedAt,
            sourceCollectionName: sourceCollectionTable.name,
            sourceCollectionDisplayName: sourceCollectionTable.displayName,
            sourceId: sourceCollectionTable.sourceId,
            sourceName: sourceTable.name,
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
          .where(and(eq(influxTable.userId, userId), eq(influxTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!result) return null;

    return {
      id: result.id,
      userId: result.userId,
      collectionId: result.collectionId,
      sourceCollectionId: result.sourceCollectionId,
      sourceCollectionName: result.sourceCollectionDisplayName || result.sourceCollectionName,
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      schema: result.schema ? (unpack(result.schema) as CollectionSchema) : null,
      filters: result.filters ? (unpack(result.filters) as Filter[]) : null,
      includeRef: result.includeRef,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
    } satisfies BackendInfluxDetails;
  }).pipe(Effect.withSpan("influxes.get", { attributes: { userId, id } }));
