import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import type {
  BackendSourceCollection,
  BackendSourceCollectionWithConnectionCount,
} from "../../domain/types";
import { DatabaseError } from "../../effect/errors";
import { Database } from "../../effect/services/Database";
import {
  consumerCollectionTable,
  sourceCollectionTable,
  type SourceCollection,
} from "../../infra/db/schema";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendSourceCollection(collection: SourceCollection): BackendSourceCollection {
  return {
    id: collection.id,
    userId: collection.userId,
    sourceId: collection.sourceId,
    name: collection.name,
    hasRef: collection.ref !== null,
    refString: collection.ref ? collection.ref.toString("utf-8") : null,
    itemCount: countItemIds(collection.itemIds),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

function mapToBackendSourceCollectionWithConnectionCount(
  collection: SourceCollection,
  connectionCount: number,
): BackendSourceCollectionWithConnectionCount {
  return {
    ...mapToBackendSourceCollection(collection),
    connectionCount,
  };
}

/**
 * Get all collections for a user with connection counts.
 */
export const listCollections = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const collections = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceCollectionTable)
          .where(eq(sourceCollectionTable.userId, userId))
          .orderBy(sourceCollectionTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const connectionCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            collectionId: consumerCollectionTable.collectionId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(consumerCollectionTable)
          .where(eq(consumerCollectionTable.userId, userId))
          .groupBy(consumerCollectionTable.collectionId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const countMap = new Map<number, number>(
      connectionCounts.map((c) => [c.collectionId, c.count]),
    );

    return collections.map((collection) =>
      mapToBackendSourceCollectionWithConnectionCount(collection, countMap.get(collection.id) ?? 0),
    );
  }).pipe(Effect.withSpan("sourceCollections.list", { attributes: { userId } }));
