import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Get a consumer with raw API key buffer.
 * INTERNAL USE ONLY - for API authentication that needs the actual key.
 * Returns undefined if not found or not owned by the user.
 */
export async function getConsumerWithKey(
  userId: number,
  id: number,
): Promise<Consumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(and(eq(consumerTable.id, id), eq(consumerTable.userId, userId)))
    .limit(1);

  return consumer;
}
