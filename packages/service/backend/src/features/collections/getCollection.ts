import { db } from "../../infra/db/db";
import { collectionTable, type Collection } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendCollection } from "../../domain/types";

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
 * Get a single collection by ID.
 */
export async function getCollection(
  userId: number,
  id: number,
): Promise<BackendCollection | undefined> {
  const [collection] = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .limit(1);

  if (!collection) return undefined;

  return mapToBackendCollection(collection);
}
