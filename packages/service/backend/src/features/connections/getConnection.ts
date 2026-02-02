import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  type Connection,
} from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnection, BackendConnectionWithDetails } from "../../domain/types";

function mapToBackendConnection(connection: Connection): BackendConnection {
  return {
    userId: connection.userId,
    consumerId: connection.consumerId,
    collectionId: connection.collectionId,
    lastItemChanged: connection.lastItemChanged,
    lastConsistencyCheck: connection.lastConsistencyCheck,
  };
}

/**
 * Get a single connection by consumer and collection ID.
 */
export async function getConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<BackendConnection | undefined> {
  const [connection] = await db
    .select()
    .from(connectionTable)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .limit(1);

  if (!connection) return undefined;

  return mapToBackendConnection(connection);
}

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
