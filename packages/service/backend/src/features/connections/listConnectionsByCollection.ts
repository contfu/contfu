import { db } from "../../infra/db/db";
import { sourceCollectionTable, connectionTable, consumerTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnectionWithDetails } from "../../domain/types";

/**
 * Get all connections for a specific collection with consumer names.
 */
export async function listConnectionsByCollection(
  userId: number,
  collectionId: number,
): Promise<BackendConnectionWithDetails[]> {
  const connections = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: sourceCollectionTable.name,
    })
    .from(connectionTable)
    .innerJoin(
      consumerTable,
      and(
        eq(connectionTable.userId, consumerTable.userId),
        eq(connectionTable.consumerId, consumerTable.id),
      ),
    )
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(connectionTable.userId, sourceCollectionTable.userId),
        eq(connectionTable.collectionId, sourceCollectionTable.id),
      ),
    )
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)));

  return connections;
}
