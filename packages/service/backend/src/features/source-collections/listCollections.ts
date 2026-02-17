import { eq, sql } from "drizzle-orm";
import type {
  BackendSourceCollection,
  BackendSourceCollectionWithConnectionCount,
} from "../../domain/types";
import { db } from "../../infra/db/db";
import {
  connectionTable,
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
export async function listCollections(
  userId: number,
): Promise<BackendSourceCollectionWithConnectionCount[]> {
  const collections = await db
    .select()
    .from(sourceCollectionTable)
    .where(eq(sourceCollectionTable.userId, userId))
    .orderBy(sourceCollectionTable.createdAt);

  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(eq(connectionTable.userId, userId))
    .groupBy(connectionTable.collectionId);

  const countMap = new Map<number, number>(connectionCounts.map((c) => [c.collectionId, c.count]));

  return collections.map((collection) =>
    mapToBackendSourceCollectionWithConnectionCount(collection, countMap.get(collection.id) ?? 0),
  );
}
