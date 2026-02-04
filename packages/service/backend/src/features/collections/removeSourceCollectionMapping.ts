import { db } from "../../infra/db/db";
import { collectionMappingTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Remove a source collection from an aggregation collection.
 */
export async function removeSourceCollectionMapping(
  userId: number,
  collectionId: number,
  sourceCollectionId: number,
): Promise<boolean> {
  const result = await db
    .delete(collectionMappingTable)
    .where(
      and(
        eq(collectionMappingTable.userId, userId),
        eq(collectionMappingTable.collectionId, collectionId),
        eq(collectionMappingTable.sourceCollectionId, sourceCollectionId),
      ),
    )
    .returning();

  return result.length > 0;
}
