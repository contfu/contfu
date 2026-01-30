import { db } from "$lib/server/db/db";
import { collectionTable, connectionTable, type Collection } from "$lib/server/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";

export type NewCollection = {
  sourceId: number;
  name: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
};

export type CollectionUpdate = {
  name?: string;
  ref?: Buffer | null;
  itemIds?: Buffer | null;
};

export type CollectionWithConnectionCount = Collection & {
  connectionCount: number;
};

/**
 * Insert a new collection for a user.
 * The ID is auto-generated as max(id) + 1 within the user's collections.
 */
export async function insertCollection(
  userId: number,
  collection: NewCollection,
): Promise<Collection> {
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
      sourceId: collection.sourceId,
      name: collection.name,
      ref: collection.ref ?? null,
      itemIds: collection.itemIds ?? null,
    })
    .returning();

  return inserted;
}

/**
 * Get all collections for a user with connection counts.
 */
export async function selectCollections(userId: number): Promise<CollectionWithConnectionCount[]> {
  const collections = await db
    .select()
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .orderBy(collectionTable.createdAt);

  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(eq(connectionTable.userId, userId))
    .groupBy(connectionTable.collectionId);

  const countMap = new Map<number, number>(
    connectionCounts.map((c: { collectionId: number; count: number }) => [c.collectionId, c.count]),
  );

  return collections.map(
    (collection: Collection): CollectionWithConnectionCount => ({
      ...collection,
      connectionCount: countMap.get(collection.id) ?? 0,
    }),
  );
}

/**
 * Get all collections for a user filtered by source ID with connection counts.
 */
export async function selectCollectionsBySource(
  userId: number,
  sourceId: number,
): Promise<CollectionWithConnectionCount[]> {
  const collections = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, sourceId)))
    .orderBy(collectionTable.createdAt);

  const collectionIds = collections.map((c: Collection) => c.id);

  if (collectionIds.length === 0) {
    return [];
  }

  const connectionCounts = await db
    .select({
      collectionId: connectionTable.collectionId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(connectionTable)
    .where(
      and(eq(connectionTable.userId, userId), inArray(connectionTable.collectionId, collectionIds)),
    )
    .groupBy(connectionTable.collectionId);

  const countMap = new Map<number, number>(
    connectionCounts.map((c: { collectionId: number; count: number }) => [c.collectionId, c.count]),
  );

  return collections.map(
    (collection: Collection): CollectionWithConnectionCount => ({
      ...collection,
      connectionCount: countMap.get(collection.id) ?? 0,
    }),
  );
}

/**
 * Get a single collection by ID.
 */
export async function selectCollection(
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

/**
 * Get a single collection by ID with connection count.
 */
export async function selectCollectionWithConnectionCount(
  userId: number,
  id: number,
): Promise<CollectionWithConnectionCount | undefined> {
  const [collection] = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .limit(1);

  if (!collection) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, id)));

  return {
    ...collection,
    connectionCount: countResult?.count ?? 0,
  };
}

/**
 * Update a collection.
 */
export async function updateCollection(
  userId: number,
  id: number,
  updates: CollectionUpdate,
): Promise<Collection | undefined> {
  const [updated] = await db
    .update(collectionTable)
    .set({
      ...updates,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning();

  return updated;
}

/**
 * Delete a collection. Connections will cascade delete.
 */
export async function deleteCollection(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning();

  return result.length > 0;
}
