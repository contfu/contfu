import { db } from "../../infra/db/db";
import { consumerTable, type Consumer } from "../../infra/db/schema";
import { eq } from "drizzle-orm";

/**
 * Find a consumer by API key.
 * INTERNAL USE ONLY - for API authentication.
 */
export async function findConsumerByKey(key: Buffer): Promise<Consumer | undefined> {
  const [consumer] = await db
    .select()
    .from(consumerTable)
    .where(eq(consumerTable.key, key))
    .limit(1);

  return consumer;
}
