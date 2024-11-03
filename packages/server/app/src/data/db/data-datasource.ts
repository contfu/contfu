import { ITEM_ID_SIZE } from "@contfu/core";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { withSchema } from "../../core/db/db";
import { SortedSet } from "../../util/structures/sorted-set";
import { SourceType } from "../data";
import {
  collection,
  collectionRelations,
  connection,
  consumerCollectionConnectionRelations,
  itemIdConflictResolution,
  source,
} from "./data-schema";

const NO_ITEM_IDS = Buffer.alloc(0);

const db = withSchema({
  source,
  collection,
  connection,
  itemIdConflictResolution,
  collectionRelations,
  consumerCollectionConnectionRelations,
});

export async function createSource(
  accountId: number,
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
  }
) {
  const id = sql`(
    SELECT COALESCE(MAX(${source.id}), 0) + 1
    FROM ${source}
    WHERE ${source.accountId} = ${accountId}
  )`;
  return (
    await db
      .insert(source)
      .values({ accountId, id, name, url, type, credentials })
      .returning()
  )[0];
}

export async function getSourcesByIds(accountId: number, ids: number[]) {
  return db.query.source.findMany({
    where: and(eq(source.accountId, accountId), inArray(source.id, ids)),
  });
}

export async function createCollection(
  accountId: number,
  sourceId: number,
  name: string,
  ref: Buffer
) {
  const id = sql`(
    SELECT COALESCE(MAX(${collection.id}), 0) + 1
    FROM ${collection}
    WHERE ${collection.accountId} = ${accountId}
  )`;
  return (
    await db
      .insert(collection)
      .values({ accountId, sourceId, name, id, ref })
      .returning()
  )[0];
}

export async function addItemIds(
  accountId: number,
  collectionId: number,
  toAdd: Buffer[]
) {
  const ids = await getItemIds(accountId, collectionId);

  for (const id of toAdd) ids.add(id);
  await db
    .update(collection)
    .set({ itemIds: serializeIds(ids) })
    .where(
      and(eq(collection.accountId, accountId), eq(collection.id, collectionId))
    );
}

export async function getItemIds(accountId: number, collectionId: number) {
  const result = await db
    .select({ itemIds: collection.itemIds })
    .from(collection)
    .where(
      and(eq(collection.accountId, accountId), eq(collection.id, collectionId))
    );
  return new SortedSet<Buffer>({
    seed: deserializeIds(result[0]?.itemIds ?? NO_ITEM_IDS),
    isSorted: true,
    compare: Buffer.compare,
  });
}

export async function createConnection(
  accountId: number,
  consumerId: number,
  collectionId: number
) {
  return (
    await db
      .insert(connection)
      .values({ accountId, consumerId, collectionId })
      .returning()
  )[0];
}

export async function countCollectionsForConsumer(
  accountId: number,
  consumerId: number
) {
  return db.$count(
    db
      .select({ collectionId: connection.collectionId })
      .from(connection)
      .where(
        and(
          eq(connection.accountId, accountId),
          eq(connection.consumerId, consumerId)
        )
      )
      .groupBy(connection.collectionId)
  );
}

export async function getConnectionsWithCollectionSyncInfo(
  ids: [accountId: number, collectionId: number][]
) {
  return db
    .select({
      account: connection.accountId,
      consumer: connection.consumerId,
      collection: connection.collectionId,
      source: collection.sourceId,
      type: source.type,
      lastItemChanged: connection.lastItemChanged,
      url: source.url,
      ref: collection.ref,
      credentials: source.credentials,
    })
    .from(connection)
    .innerJoin(
      collection,
      and(
        eq(connection.accountId, collection.accountId),
        eq(connection.collectionId, collection.id)
      )
    )
    .innerJoin(
      source,
      and(
        eq(collection.accountId, source.accountId),
        eq(collection.sourceId, source.id)
      )
    )
    .where(
      inArray(sql`(${connection.accountId}, ${connection.collectionId})`, ids)
    )
    .orderBy(asc(connection.accountId), asc(connection.collectionId));
}

export async function getConnectionsToCollections(
  refs: (readonly [accountId: number, collectionId: number])[]
) {
  return db.query.connection.findMany({
    where: inArray(
      sql`(${connection.accountId}, ${connection.collectionId})`,
      refs
    ),
    orderBy: [asc(connection.accountId), asc(connection.collectionId)],
  });
}

export async function createItemIdConflictResolution(
  accountId: number,
  collectionId: number,
  sourceItemId: Buffer,
  id: number
) {
  await db
    .insert(itemIdConflictResolution)
    .values({ accountId, collectionId, sourceItemId, id });
}

export async function getItemId(
  accountId: number,
  collectionId: number,
  sourceItemId: Buffer
) {
  const result = await db.query.itemIdConflictResolution.findFirst({
    where: and(
      eq(itemIdConflictResolution.accountId, accountId),
      eq(itemIdConflictResolution.collectionId, collectionId),
      eq(itemIdConflictResolution.sourceItemId, sourceItemId)
    ),
  });
  if (result) return result.id;
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
