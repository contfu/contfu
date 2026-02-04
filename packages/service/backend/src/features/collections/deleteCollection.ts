import { db } from "../../infra/db/db";
import { sourceCollectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a collection. Connections will cascade delete.
 */
export async function deleteCollection(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(sourceCollectionTable)
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .returning();

  return result.length > 0;
}
