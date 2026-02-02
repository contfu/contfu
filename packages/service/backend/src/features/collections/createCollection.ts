import { db } from "../../infra/db/db";
import { collectionTable, type Collection } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BackendCollection, CreateCollectionInput } from "../../domain/types";

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
 * Create a new collection for a user.
 * The ID is auto-generated as max(id) + 1 within the user's collections.
 */
export async function createCollection(
  userId: number,
  input: CreateCollectionInput,
): Promise<BackendCollection> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(collectionTable)
    .values({
      userId,
      id: nextId,
      sourceId: input.sourceId,
      name: input.name,
      ref: input.ref ?? null,
      itemIds: input.itemIds ?? null,
    })
    .returning();

  return mapToBackendCollection(inserted);
}
