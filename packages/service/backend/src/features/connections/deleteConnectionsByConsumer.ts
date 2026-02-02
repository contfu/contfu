import { db } from "../../infra/db/db";
import { connectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

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
