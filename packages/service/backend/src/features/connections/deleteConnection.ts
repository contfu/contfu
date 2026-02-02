import { db } from "../../infra/db/db";
import { connectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a connection.
 */
export async function deleteConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
): Promise<boolean> {
  const result = await db
    .delete(connectionTable)
    .where(
      and(
        eq(connectionTable.userId, userId),
        eq(connectionTable.consumerId, consumerId),
        eq(connectionTable.collectionId, collectionId),
      ),
    )
    .returning();

  return result.length > 0;
}

/**
 * Delete all connections for a consumer.
 */
export async function deleteConnectionsByConsumer(
  userId: number,
  consumerId: number,
): Promise<number> {
  const result = await db
    .delete(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.consumerId, consumerId)))
    .returning();

  return result.length;
}

/**
 * Delete all connections for a collection.
 */
export async function deleteConnectionsByCollection(
  userId: number,
  collectionId: number,
): Promise<number> {
  const result = await db
    .delete(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)))
    .returning();

  return result.length;
}
