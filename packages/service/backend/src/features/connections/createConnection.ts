import { db } from "../../infra/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  type Connection,
} from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendConnection, CreateConnectionInput } from "../../domain/types";

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
 * Create a new connection for a user.
 */
export async function createConnection(
  userId: number,
  input: CreateConnectionInput,
): Promise<BackendConnection> {
  const [consumer, collection] = await Promise.all([
    db
      .select({ id: consumerTable.id })
      .from(consumerTable)
      .where(and(eq(consumerTable.id, input.consumerId), eq(consumerTable.userId, userId)))
      .limit(1),
    db
      .select({ id: collectionTable.id })
      .from(collectionTable)
      .where(and(eq(collectionTable.id, input.collectionId), eq(collectionTable.userId, userId)))
      .limit(1),
  ]);

  if (!consumer[0]) {
    throw new Error("Consumer not found");
  }
  if (!collection[0]) {
    throw new Error("Collection not found");
  }

  const [inserted] = await db
    .insert(connectionTable)
    .values({
      userId,
      consumerId: input.consumerId,
      collectionId: input.collectionId,
      includeRef: input.includeRef ?? true,
      lastItemChanged: input.lastItemChanged ?? null,
      lastConsistencyCheck: input.lastConsistencyCheck ?? null,
    })
    .returning();

  return mapToBackendConnection(inserted);
}
