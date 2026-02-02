import { db } from "../../infra/db/db";
import { collectionTable } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Update collection's itemIds buffer directly.
 * INTERNAL USE ONLY - for sync workers.
 */
export async function updateCollectionItemIds(
  userId: number,
  id: number,
  itemIds: Buffer | null,
): Promise<boolean> {
  const result = await db
    .update(collectionTable)
    .set({
      itemIds,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning({ id: collectionTable.id });

  return result.length > 0;
}
