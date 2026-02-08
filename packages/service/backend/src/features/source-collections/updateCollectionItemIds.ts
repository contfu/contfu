import { db } from "../../infra/db/db";
import { sourceCollectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

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
    .update(sourceCollectionTable)
    .set({
      itemIds,
      updatedAt: new Date(),
    })
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .returning({ id: sourceCollectionTable.id });

  return result.length > 0;
}
