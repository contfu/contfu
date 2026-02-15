import { db } from "../../infra/db/db";
import { sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a source. Collections will cascade delete.
 * Returns false if not found or not owned by the user.
 */
export async function deleteSource(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(sourceTable)
    .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
    .returning();

  return result.length > 0;
}
