import { db } from "../../infra/db/db";
import { connectionTable, type Connection } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnection } from "../../domain/types";

function mapToBackendConnection(connection: Connection): BackendConnection {
  return {
    userId: connection.userId,
    consumerId: connection.consumerId,
    collectionId: connection.collectionId,
    includeRef: connection.includeRef,
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
