import { and, eq, sql } from "drizzle-orm";
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
 * Get a single collection by ID with connection count.
 */
export const getCollectionWithConnectionCount = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [collection] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceCollectionTable)
          .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!collection) return undefined;

    const [countResult] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ count: sql<number>`count(*)` })
          .from(consumerCollectionTable)
          .where(
            and(
              eq(consumerCollectionTable.userId, userId),
              eq(consumerCollectionTable.collectionId, id),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return mapToBackendSourceCollectionWithConnectionCount(collection, countResult?.count ?? 0);
  }).pipe(Effect.withSpan("sourceCollections.getWithConnectionCount", { attributes: { userId } }));
