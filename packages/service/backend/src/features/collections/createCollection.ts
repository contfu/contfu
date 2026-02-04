import { db } from "../../infra/db/db";
import { sourceCollectionTable, type SourceCollection } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BackendCollection, CreateCollectionInput } from "../../domain/types";

function countItemIds(itemIds: Buffer | null): number {
  if (!itemIds) return 0;
  // Each item ID is 4 bytes
  return Math.floor(itemIds.length / 4);
}

function mapToBackendCollection(collection: SourceCollection): BackendCollection {
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
 * Create a new collection for a user.
 * The ID is auto-generated as max(id) + 1 within the user's collections.
 * Uses a transaction to prevent race conditions in ID generation.
 */
export async function createCollection(
  userId: number,
  input: CreateCollectionInput,
): Promise<BackendCollection> {
  // Use transaction to atomically generate ID and insert
  const inserted = await db.transaction(async (tx) => {
    const maxIdResult = await tx
      .select({ maxId: sql<number>`coalesce(max(id), 0)` })
      .from(sourceCollectionTable)
      .where(eq(sourceCollectionTable.userId, userId))
      .limit(1);

    const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

    const [result] = await tx
      .insert(sourceCollectionTable)
      .values({
        userId,
        id: nextId,
        sourceId: input.sourceId,
        name: input.name,
        ref: input.ref ?? null,
        itemIds: input.itemIds ?? null,
      })
      .returning();

    return result;
  });

  return mapToBackendCollection(inserted);
}
