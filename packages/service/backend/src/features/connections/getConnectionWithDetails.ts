import { db } from "../../infra/db/db";
import { sourceCollectionTable, connectionTable, consumerTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnectionWithDetails } from "../../domain/types";

/**
 * Get a single connection with consumer and collection details.
 */
export async function getConnectionWithDetails(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<BackendConnectionWithDetails | undefined> {
  const [connection] = await db
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
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .limit(1);

  return connection;
}
