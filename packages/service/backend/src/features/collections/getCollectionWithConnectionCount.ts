import { db } from "../../infra/db/db";
import { sourceCollectionTable, connectionTable, type SourceCollection } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
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
 * Get a single collection by ID with connection count.
 */
export async function getCollectionWithConnectionCount(
  userId: number,
  id: number,
): Promise<BackendCollectionWithConnectionCount | undefined> {
  const [collection] = await db
    .select()
    .from(sourceCollectionTable)
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .limit(1);

  if (!collection) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, id)));

  return mapToBackendCollectionWithConnectionCount(collection, countResult?.count ?? 0);
}
