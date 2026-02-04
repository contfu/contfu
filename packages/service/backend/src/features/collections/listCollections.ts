import { db } from "../../infra/db/db";
import { collectionTable, collectionMappingTable, connectionTable } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";

export interface Collection {
  id: number;
  userId: number;
  name: string;
  sourceCollectionCount: number;
  connectionCount: number;
  createdAt: number;
  updatedAt: number | null;
}

/**
 * List all Collections for a user with counts.
 * These are the collections that consumers can subscribe to.
 */
export async function listCollections(
  userId: number,
): Promise<Collection[]> {
  const collections = await db
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .orderBy(collectionTable.createdAt);

  // Get source collection counts per collection
  const mappingCounts = await db
    .select({
      collectionId: collectionMappingTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(collectionMappingTable)
    .where(eq(collectionMappingTable.userId, userId))
    .groupBy(collectionMappingTable.collectionId);

  const mappingCountMap = new Map<number, number>(
    mappingCounts.map((c) => [c.collectionId, c.count])
  );

  // Get connection counts per collection
  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(eq(connectionTable.userId, userId))
    .groupBy(connectionTable.collectionId);

  const connectionCountMap = new Map<number, number>(
    connectionCounts.map((c) => [c.collectionId, c.count])
  );

  return collections.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    sourceCollectionCount: mappingCountMap.get(c.id) ?? 0,
    connectionCount: connectionCountMap.get(c.id) ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}
