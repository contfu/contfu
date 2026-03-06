import { and, eq, inArray, sql } from "drizzle-orm";
import { Effect } from "effect";
import type { BackendSourceCollectionSummary } from "../../domain/types";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import { consumerCollectionTable, sourceCollectionTable } from "../../infra/db/schema";

/**
 * Get all collections for a user filtered by source ID with connection counts.
 * Returns minimal collection info (id, name, ref, createdAt) for summaries.
 */
export const listCollectionSummariesBySource = (userId: number, sourceId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const collections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            id: sourceCollectionTable.id,
            name: sourceCollectionTable.name,
            ref: sourceCollectionTable.ref,
            createdAt: sourceCollectionTable.createdAt,
          })
          .from(sourceCollectionTable)
          .where(
            and(
              eq(sourceCollectionTable.userId, userId),
              eq(sourceCollectionTable.sourceId, sourceId),
            ),
          )
          .orderBy(sourceCollectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const collectionIds = collections.map((c) => c.id);

    if (collectionIds.length === 0) {
      return [] as BackendSourceCollectionSummary[];
    }

    const connectionCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: consumerCollectionTable.collectionId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(consumerCollectionTable)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              inArray(consumerCollectionTable.collectionId, collectionIds),
            ),
          )
          .groupBy(consumerCollectionTable.collectionId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const countMap = new Map<number, number>(
      connectionCounts.map((c) => [c.collectionId, c.count]),
    );

    return collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      refString: collection.ref ? collection.ref.toString("utf-8") : null,
      createdAt: collection.createdAt,
      connectionCount: countMap.get(collection.id) ?? 0,
    }));
  }).pipe(
    Effect.withSpan("sourceCollections.listSummariesBySource", {
      attributes: { userId, sourceId },
    }),
  );
