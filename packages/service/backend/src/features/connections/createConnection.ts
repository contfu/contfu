import { db } from "../../infra/db/db";
import { connectionTable, type Connection } from "../../infra/db/schema";
import type { BackendConnection, CreateConnectionInput } from "../../domain/types";

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
 * Create a new connection for a user.
 */
export async function createConnection(
  userId: number,
  input: CreateConnectionInput,
): Promise<BackendConnection> {
  const [inserted] = await db
    .insert(connectionTable)
    .values({
      userId,
      consumerId: input.consumerId,
      collectionId: input.collectionId,
      lastItemChanged: input.lastItemChanged ?? null,
      lastConsistencyCheck: input.lastConsistencyCheck ?? null,
    })
    .returning();

  return mapToBackendConnection(inserted);
}
