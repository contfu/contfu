import { db } from "../../infra/db/db";
import { sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a source. Collections will cascade delete.
 */
export async function deleteSource(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .returning();

  return result.length > 0;
}
