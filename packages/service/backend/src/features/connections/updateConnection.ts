import { db } from "../../infra/db/db";
import { connectionTable, type Connection } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnection, UpdateConnectionInput } from "../../domain/types";

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
 * Update a connection.
 */
export async function updateConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
  input: UpdateConnectionInput,
): Promise<BackendConnection | undefined> {
  const [updated] = await db
    .update(connectionTable)
    .set(input)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .returning();

  if (!updated) return undefined;

  return mapToBackendConnection(updated);
}
