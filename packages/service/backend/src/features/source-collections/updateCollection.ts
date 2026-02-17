import { and, eq } from "drizzle-orm";
import type { BackendSourceCollection, UpdateSourceCollectionInput } from "../../domain/types";
import { db } from "../../infra/db/db";
import { sourceCollectionTable, type SourceCollection } from "../../infra/db/schema";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendSourceCollection(collection: SourceCollection): BackendSourceCollection {
  return {
    id: collection.id,
    userId: collection.userId,
    sourceId: collection.sourceId,
    name: collection.name,
    hasRef: collection.ref !== null,
    refString: collection.ref ? collection.ref.toString("utf-8") : null,
    itemCount: countItemIds(collection.itemIds),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

/**
 * Update a collection.
 */
export async function updateCollection(
  userId: number,
  id: number,
  input: UpdateSourceCollectionInput,
): Promise<BackendSourceCollection | undefined> {
  const [updated] = await db
    .update(sourceCollectionTable)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(and(eq(sourceCollectionTable.userId, userId), eq(sourceCollectionTable.id, id)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendSourceCollection(updated);
}
