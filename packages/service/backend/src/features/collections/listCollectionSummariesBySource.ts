import { db } from "../../infra/db/db";
import { collectionTable, connectionTable } from "../../infra/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { BackendCollectionSummary } from "../../domain/types";

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

  const countMap = new Map<number, number>(connectionCounts.map((c) => [c.collectionId, c.count]));

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    refString: collection.ref ? collection.ref.toString("utf-8") : null,
    createdAt: collection.createdAt,
    connectionCount: countMap.get(collection.id) ?? 0,
  }));
}
