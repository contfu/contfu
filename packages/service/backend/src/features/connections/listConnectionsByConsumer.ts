import { db } from "../../infra/db/db";
import { collectionTable, connectionTable, consumerTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnectionWithDetails } from "../../domain/types";

/**
 * Get all connections for a specific consumer with collection names.
 */
export async function listConnectionsByConsumer(
  userId: number,
  consumerId: number,
): Promise<BackendConnectionWithDetails[]> {
  const connections = await db
    .select({
      userId: connectionTable.userId,
      consumerId: connectionTable.consumerId,
      collectionId: connectionTable.collectionId,
      includeRef: connectionTable.includeRef,
      lastItemChanged: connectionTable.lastItemChanged,
      lastConsistencyCheck: connectionTable.lastConsistencyCheck,
      consumerName: consumerTable.name,
      collectionName: collectionTable.name,
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
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)));

  return connections;
}
