import { db } from "$lib/server/db/db";
import { collectionTable, sourceTable, type Source } from "$lib/server/db/schema";
import { and, eq, sql } from "drizzle-orm";

export type NewSource = {
  name: string;
  type: number;
  url?: string | null;
  credentials: Buffer;
};

export type SourceUpdate = {
  name?: string;
  url?: string | null;
  credentials?: Buffer;
};

export type SourceWithCollectionCount = Source & {
  collectionCount: number;
};

/**
 * Insert a new source for a user.
 * The ID is auto-generated as max(id) + 1 within the user's sources.
 */
export async function insertSource(userId: number, source: NewSource): Promise<Source> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  const [inserted] = await db
    .insert(sourceTable)
    .values({
      userId,
      id: nextId,
      name: source.name,
      type: source.type,
      url: source.url ?? null,
      credentials: source.credentials,
    })
    .returning();

  return inserted;
}

/**
 * Get all sources for a user with collection counts.
 */
export async function selectSources(userId: number): Promise<SourceWithCollectionCount[]> {
  const sources = await db
    .select()
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .orderBy(sourceTable.createdAt);

  const collectionCounts = await db
    .select({
      sourceId: collectionTable.sourceId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .groupBy(collectionTable.sourceId);

  const countMap = new Map<number, number>(
    collectionCounts.map((c: { sourceId: number; count: number }) => [c.sourceId, c.count]),
  );

  return sources.map(
    (source: Source): SourceWithCollectionCount => ({
      ...source,
      collectionCount: countMap.get(source.id) ?? 0,
    }),
  );
}

/**
 * Get a single source by ID.
 */
export async function selectSource(userId: number, id: number): Promise<Source | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  return source;
}

/**
 * Get a single source by ID with collection count.
 */
export async function selectSourceWithCollectionCount(
  userId: number,
  id: number,
): Promise<SourceWithCollectionCount | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  if (!source) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, id)));

  return {
    ...source,
    collectionCount: countResult?.count ?? 0,
  };
}

/**
 * Update a source.
 */
export async function updateSource(
  userId: number,
  id: number,
  updates: SourceUpdate,
): Promise<Source | undefined> {
  const [updated] = await db
    .update(sourceTable)
    .set({
      ...updates,
      updatedAt: sql`(unixepoch())`,
    })
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .returning();

  return updated;
}

/**
 * Delete a source. Collections will cascade delete.
 */
export async function deleteSource(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .returning();

  return result.length > 0;
}
