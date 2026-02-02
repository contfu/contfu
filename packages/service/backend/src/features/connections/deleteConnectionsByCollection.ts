import { db } from "../../infra/db/db";
import { connectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

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
