import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a Collection.
 * This will cascade delete all mappings and connections.
 */
export async function deleteCollection(userId: number, collectionId: number): Promise<boolean> {
  const result = await db
    .delete(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
    .returning();

  return result.length > 0;
}
