import { db } from "../../infra/db/db";
import { collectionTable, connectionTable, type Collection } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { BackendCollection, BackendCollectionWithConnectionCount } from "../../domain/types";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendCollection(collection: Collection): BackendCollection {
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
  collection: Collection,
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
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .limit(1);

  if (!collection) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, id)));

  return mapToBackendCollectionWithConnectionCount(collection, countResult?.count ?? 0);
}
