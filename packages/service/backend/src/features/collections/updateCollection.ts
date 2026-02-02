import { db } from "../../infra/db/db";
import { collectionTable, type Collection } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { BackendCollection, UpdateCollectionInput } from "../../domain/types";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendCollection(collection: Collection): BackendCollection {
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
  input: UpdateCollectionInput,
): Promise<BackendCollection | undefined> {
  const [updated] = await db
    .update(collectionTable)
    .set({
      ...input,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendCollection(updated);
}

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
