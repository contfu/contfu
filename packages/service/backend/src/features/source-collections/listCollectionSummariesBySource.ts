import { and, eq, inArray, sql } from "drizzle-orm";
import type { BackendSourceCollectionSummary } from "../../domain/types";
import { db } from "../../infra/db/db";
import { connectionTable, sourceCollectionTable } from "../../infra/db/schema";

/**
 * Get all collections for a user filtered by source ID with connection counts.
 * Returns minimal collection info (id, name, ref, createdAt) for summaries.
 */
export async function listCollectionSummariesBySource(
  userId: number,
  sourceId: number,
): Promise<BackendSourceCollectionSummary[]> {
  const collections = await db
    .select({
      id: sourceCollectionTable.id,
      name: sourceCollectionTable.name,
      ref: sourceCollectionTable.ref,
      createdAt: sourceCollectionTable.createdAt,
    })
    .from(sourceCollectionTable)
    .where(
      and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.sourceId, sourceId)),
    )
    .orderBy(sourceCollectionTable.createdAt);

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
