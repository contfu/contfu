import { db } from "../../infra/db/db";
import { collectionTable, type Collection } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Get a collection with raw ref and itemIds buffers.
 * INTERNAL USE ONLY - for sync workers that need the actual buffer data.
 */
export async function getCollectionWithBuffers(
  userId: number,
  id: number,
): Promise<Collection | undefined> {
  const [collection] = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .limit(1);

  return collection;
}
