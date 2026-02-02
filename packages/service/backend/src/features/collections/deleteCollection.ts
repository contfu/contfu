import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a collection. Connections will cascade delete.
 */
export async function deleteCollection(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning();

  return result.length > 0;
}
