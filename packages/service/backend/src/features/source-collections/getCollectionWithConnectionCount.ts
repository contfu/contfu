import { and, eq, sql } from "drizzle-orm";
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
 * Get a single collection by ID with connection count.
 */
export async function getCollectionWithConnectionCount(
  userId: number,
  id: number,
): Promise<BackendSourceCollectionWithConnectionCount | undefined> {
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

  return mapToBackendSourceCollectionWithConnectionCount(collection, countResult?.count ?? 0);
}
