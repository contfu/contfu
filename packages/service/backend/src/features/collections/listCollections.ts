import { db } from "../../infra/db/db";
import { sourceCollectionTable, connectionTable, type SourceCollection } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BackendCollection, BackendCollectionWithConnectionCount } from "../../domain/types";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendCollection(collection: SourceCollection): BackendCollection {
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

function mapToBackendCollectionWithConnectionCount(
  collection: SourceCollection,
  connectionCount: number,
): BackendCollectionWithConnectionCount {
  return {
    ...mapToBackendCollection(collection),
    connectionCount,
  };
}

/**
 * Get all collections for a user with connection counts.
 */
export async function listCollections(
  userId: number,
): Promise<BackendCollectionWithConnectionCount[]> {
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
    mapToBackendCollectionWithConnectionCount(collection, countMap.get(collection.id) ?? 0),
  );
}
