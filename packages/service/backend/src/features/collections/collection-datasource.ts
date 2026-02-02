import { db } from "../../infra/db/db";
import { collectionTable, connectionTable, type Collection } from "../../infra/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import type {
  BackendCollection,
  BackendCollectionWithConnectionCount,
  BackendCollectionSummary,
  CreateCollectionInput,
  UpdateCollectionInput,
} from "../../domain/types";

// =============================================================================
// Mappers (DB → Domain)
// =============================================================================

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

function mapToBackendCollectionWithConnectionCount(
  collection: Collection,
  connectionCount: number,
): BackendCollectionWithConnectionCount {
  return {
    ...mapToBackendCollection(collection),
    connectionCount,
  };
}

// =============================================================================
// Public Feature Functions (return domain types)
// =============================================================================

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

/**
 * Get all collections for a user with connection counts.
 */
export async function listCollections(
  userId: number,
): Promise<BackendCollectionWithConnectionCount[]> {
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
    connectionCounts.map((c) => [c.collectionId, c.count]),
  );

  return collections.map((collection) =>
    mapToBackendCollectionWithConnectionCount(collection, countMap.get(collection.id) ?? 0),
  );
}

/**
 * Get all collections for a user filtered by source ID with connection counts.
 * Returns minimal collection info (id, name, ref, createdAt) for summaries.
 */
export async function listCollectionSummariesBySource(
  userId: number,
  sourceId: number,
): Promise<BackendCollectionSummary[]> {
  const collections = await db
    .select({
      id: collectionTable.id,
      name: collectionTable.name,
      ref: collectionTable.ref,
      createdAt: collectionTable.createdAt,
    })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, sourceId)))
    .orderBy(collectionTable.createdAt);

  const collectionIds = collections.map((c) => c.id);

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
    connectionCounts.map((c) => [c.collectionId, c.count]),
  );

  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    refString: collection.ref ? collection.ref.toString("utf-8") : null,
    createdAt: collection.createdAt,
    connectionCount: countMap.get(collection.id) ?? 0,
  }));
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

/**
 * Get a single collection by ID with connection count.
 */
export async function getCollectionWithConnectionCount(
  userId: number,
  id: number,
): Promise<BackendCollectionWithConnectionCount | undefined> {
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

  return mapToBackendCollectionWithConnectionCount(collection, countResult?.count ?? 0);
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
 * Delete a collection. Connections will cascade delete.
 */
export async function deleteCollection(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, id)))
    .returning();

  return result.length > 0;
}

// =============================================================================
// Internal Functions (with raw buffers - for internal backend use only)
// =============================================================================

/**
 * Get a collection with raw ref and itemIds buffers.
 * INTERNAL USE ONLY - for sync workers that need the actual buffer data.
 */
export async function getCollectionWithBuffers(
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

// =============================================================================
// Legacy exports (deprecated - use new function names)
// =============================================================================

/** @deprecated Use createCollection instead */
export const insertCollection = createCollection;

/** @deprecated Use listCollections instead */
export const selectCollections = listCollections;

/** @deprecated Use listCollectionSummariesBySource instead */
export const getCollectionSummariesBySource = listCollectionSummariesBySource;

/** @deprecated Use getCollection instead */
export const selectCollection = getCollection;

/** @deprecated Use getCollectionWithConnectionCount instead */
export const selectCollectionWithConnectionCount = getCollectionWithConnectionCount;

// Re-export types for convenience
export type {
  BackendCollection,
  BackendCollectionWithConnectionCount,
  BackendCollectionSummary,
} from "../../domain/types";

// Legacy type aliases for backwards compatibility
export type NewCollection = CreateCollectionInput;
export type CollectionUpdate = UpdateCollectionInput;
export type CollectionWithConnectionCount = BackendCollectionWithConnectionCount;
export type CollectionSummary = BackendCollectionSummary;
