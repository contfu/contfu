import { db } from "../../infra/db/db";
import { collectionTable, connectionTable, type Collection } from "../../infra/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  BackendCollection,
  BackendCollectionWithConnectionCount,
  BackendCollectionSummary,
} from "../../domain/types";

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
 * Get all collections for a user with connection counts.
 */
export async function listCollections(
  userId: number,
): Promise<BackendCollectionWithConnectionCount[]> {
  const collections = await db
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .orderBy(collectionTable.createdAt);

  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(eq(connectionTable.userId, userId))
    .groupBy(connectionTable.collectionId);

  const countMap = new Map<number, number>(
    connectionCounts.map((c) => [c.collectionId, c.count]),
  );

  return collections.map((collection) =>
    mapToBackendCollectionWithConnectionCount(collection, countMap.get(collection.id) ?? 0),
  );
}

/**
 * Get all collections for a user filtered by source ID with connection counts.
 * Returns minimal collection info (id, name, ref, createdAt) for summaries.
 */
export async function listCollectionSummariesBySource(
  userId: number,
  sourceId: number,
): Promise<BackendCollectionSummary[]> {
  const collections = await db
    .select({
      id: collectionTable.id,
      name: collectionTable.name,
      ref: collectionTable.ref,
      createdAt: collectionTable.createdAt,
    })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, sourceId)))
    .orderBy(collectionTable.createdAt);

  const collectionIds = collections.map((c) => c.id);

  if (collectionIds.length === 0) {
    return [];
  }

  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(
      and(eq(connectionTable.userId, userId), inArray(connectionTable.collectionId, collectionIds)),
    )
    .groupBy(connectionTable.collectionId);

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
}
