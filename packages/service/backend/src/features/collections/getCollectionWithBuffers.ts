import { db } from "../../infra/db/db";
import { sourceCollectionTable, type SourceCollection } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Get a collection with raw ref and itemIds buffers.
 * INTERNAL USE ONLY - for sync workers that need the actual buffer data.
 */
export async function getCollectionWithBuffers(
  userId: number,
  id: number,
): Promise<SourceCollection | undefined> {
  const [collection] = await db
    .select()
    .from(sourceCollectionTable)
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .limit(1);

  return collection;
}
