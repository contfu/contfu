import { ITEM_ID_SIZE } from "@contfu/core";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  collectionTable,
  connectionTable,
  db,
  itemIdConflictResolutionTable,
  sourceTable,
} from "~/db/db";
import { SortedSet } from "../../util/structures/sorted-set";
import { SourceType } from "../data";

const NO_ITEM_IDS = Buffer.alloc(0);

export async function createSource(
  userId: number,
  {
    name,
    type,
    url,
    credentials,
  }: {
    name?: string;
    type: SourceType;
    url?: string;
    credentials?: Buffer;
  },
) {
  const id = sql`(
    SELECT COALESCE(MAX(${sourceTable.id}), 0) + 1
    FROM ${sourceTable}
    WHERE ${sourceTable.userId} = ${userId}
  )`;
  return (
    await db
      .insert(sourceTable)
      .values({ userId, id, name, url, type, credentials })
      .returning()
  )[0];
}

export async function getSourcesByIds(userId: number, ids: number[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), inArray(sourceTable.id, ids)))
    .all();
}

export async function createCollection(
  userId: number,
  sourceId: number,
  name: string,
  ref: Buffer,
) {
  const id = sql`(
    SELECT COALESCE(MAX(${collectionTable.id}), 0) + 1
    FROM ${collectionTable}
    WHERE ${collectionTable.userId} = ${userId}
  )`;
  return (
    await db
      .insert(collectionTable)
      .values({ userId, sourceId, name, id, ref })
      .returning()
  )[0];
}

export async function addItemIds(
  userId: number,
  collectionId: number,
  toAdd: Buffer[],
) {
  const ids = await getItemIds(userId, collectionId);

  for (const id of toAdd) ids.add(id);
  await db
    .update(collectionTable)
    .set({ itemIds: serializeIds(ids) })
    .where(
      and(
        eq(collectionTable.userId, userId),
        eq(collectionTable.id, collectionId),
      ),
    );
}

export async function getItemIds(userId: number, collectionId: number) {
  const result = await db
    .select({ itemIds: collectionTable.itemIds })
    .from(collectionTable)
    .where(
      and(
        eq(collectionTable.userId, userId),
        eq(collectionTable.id, collectionId),
      ),
    );
  return new SortedSet<Buffer>({
    seed: deserializeIds(result[0]?.itemIds ?? NO_ITEM_IDS),
    isSorted: true,
    compare: Buffer.compare,
  });
}

export async function createConnection(
  userId: number,
  consumerId: number,
  collectionId: number,
) {
  return (
    await db
      .insert(connectionTable)
      .values({ userId, consumerId, collectionId })
      .returning()
  )[0];
}

export async function countCollectionsForConsumer(
  userId: number,
  consumerId: number,
) {
  return db.$count(
    db
      .select({ collectionId: connectionTable.collectionId })
      .from(connectionTable)
      .where(
        and(
          eq(connectionTable.userId, userId),
          eq(connectionTable.consumerId, consumerId),
        ),
      )
      .groupBy(connectionTable.collectionId),
  );
}

export async function getConnectionsWithCollectionSyncInfo(
  ids: [userId: number, collectionId: number][],
) {
  return db
    .select({
      user: connectionTable.userId,
      consumer: connectionTable.consumerId,
      collection: connectionTable.collectionId,
      source: collectionTable.sourceId,
      type: sourceTable.type,
      lastItemChanged: connectionTable.lastItemChanged,
      url: sourceTable.url,
      ref: collectionTable.ref,
      credentials: sourceTable.credentials,
    })
    .from(connectionTable)
    .innerJoin(
      collectionTable,
      and(
        eq(connectionTable.userId, collectionTable.userId),
        eq(connectionTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      sourceTable,
      and(
        eq(collectionTable.userId, sourceTable.userId),
        eq(collectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(
      inArray(
        sql`(${connectionTable.userId}, ${connectionTable.collectionId})`,
        ids,
      ),
    )
    .orderBy(asc(connectionTable.userId), asc(connectionTable.collectionId));
}

export async function getConnectionsToCollections(
  refs: (readonly [userId: number, collectionId: number])[],
) {
  return db.query.connection.findMany({
    where: inArray(
      sql`(${connectionTable.userId}, ${connectionTable.collectionId})`,
      refs,
    ),
    orderBy: [asc(connectionTable.userId), asc(connectionTable.collectionId)],
  });
}

export async function createItemIdConflictResolution(
  userId: number,
  collectionId: number,
  sourceItemId: Buffer,
  id: number,
) {
  await db
    .insert(itemIdConflictResolutionTable)
    .values({ userId, collectionId, sourceItemId, id });
}

export async function getItemId(
  userId: number,
  collectionId: number,
  sourceItemId: Buffer,
) {
  const results = await db
    .select()
    .from(itemIdConflictResolutionTable)
    .where(
      and(
        eq(itemIdConflictResolutionTable.userId, userId),
        eq(itemIdConflictResolutionTable.collectionId, collectionId),
        eq(itemIdConflictResolutionTable.sourceItemId, sourceItemId),
      ),
    )
    .limit(1)
    .all();
  if (results.length > 0) return results[0].id;
  return sourceItemId.subarray(-4).readUInt32LE(0);
}

function serializeIds(ids: Buffer[]) {
  return Buffer.concat(ids);
}

function deserializeIds(ids: Buffer) {
  const count = ids.length / ITEM_ID_SIZE;
  const result = new Array<Buffer>(count);
  for (let i = 0; i < count; i++) {
    const idx = i * ITEM_ID_SIZE;
    result[i] = ids.subarray(idx, idx + ITEM_ID_SIZE);
  }
  return result;
}
