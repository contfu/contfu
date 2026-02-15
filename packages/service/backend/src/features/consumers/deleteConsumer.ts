import { db } from "../../infra/db/db";
import { consumerTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a consumer. Connections will cascade delete.
 * Returns false if not found or not owned by the user.
 */
export async function deleteConsumer(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(consumerTable)
    .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
    .returning();

  return result.length > 0;
}
