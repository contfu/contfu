import { db } from "../../infra/db/db";
import { consumerTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete a consumer. Connections will cascade delete.
 */
export async function deleteConsumer(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(consumerTable)
    .where(and(eq(consumerTable.userId, userId), eq(consumerTable.id, id)))
    .returning();

  return result.length > 0;
}
