import type { BackendCollection } from "../../domain/types";
import { db } from "../../infra/db/db";
import { collectionTable, influxTable, connectionTable } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";

/**
 * List all Collections for a user with counts.
 * These are the collections that consumers can subscribe to.
 */
export async function listCollections(userId: number): Promise<BackendCollection[]> {
  const collections = await db
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .orderBy(collectionTable.createdAt);

  // Get influx counts per collection
  const influxCounts = await db
    .select({
      collectionId: influxTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(influxTable)
    .where(eq(influxTable.userId, userId))
    .groupBy(influxTable.collectionId);

  const influxCountMap = new Map<number, number>(
    influxCounts.map((c) => [c.collectionId, c.count]),
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
    connectionCounts.map((c) => [c.collectionId, c.count]),
  );

  return collections.map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    includeRef: c.includeRef,
    influxCount: influxCountMap.get(c.id) ?? 0,
    connectionCount: connectionCountMap.get(c.id) ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
}
