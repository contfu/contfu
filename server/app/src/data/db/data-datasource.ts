import { SourceConfig } from "@contfu/core";
import { and, eq, inArray, sql } from "drizzle-orm";
import { withSchema } from "../../core/db";
import {
  collection,
  collectionRelations,
  consumerCollectionConnection,
  consumerCollectionConnectionRelations,
  itemIdConflictResolution,
  source,
} from "./data-schema";
const db = withSchema({
  source,
  collection,
  consumerCollectionConnection,
  itemIdConflictResolution,
  collectionRelations,
  consumerCollectionConnectionRelations,
});

export async function createSource(
  accountId: number,
  name: string,
  config: Omit<SourceConfig, "collections">
) {
  const nextId = sql`(
    SELECT COALESCE(MAX(${source.id}), 0) + 1
    FROM ${source}
    WHERE ${source.accountId} = ${accountId}
  )`;
  return (
    await db
      .insert(source)
      .values({
        accountId,
        name,
        type: config.type,
        id: nextId,
        key: config.key,
        opts: {},
      })
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
  opts?: Record<string, any>
) {
  const nextId = sql`(
    SELECT COALESCE(MAX(${collection.id}), 0) + 1
    FROM ${collection}
    WHERE ${collection.accountId} = ${accountId}
  )`;
  return (
    await db
      .insert(collection)
      .values({ accountId, sourceId, name, id: nextId, opts })
      .returning()
  )[0];
}

export async function createConsumerCollectionConnection(
  accountId: number,
  consumerId: number,
  collectionId: number
) {
  return (
    await db
      .insert(consumerCollectionConnection)
      .values({
        accountId,
        consumerId,
        collectionId,
        ids: Buffer.from([]),
      })
      .returning()
  )[0];
}

export async function getCollectionsForConsumer(
  accountId: number,
  consumerId: number
) {
  return db.query.consumerCollectionConnection.findMany({
    where: and(
      eq(consumerCollectionConnection.accountId, accountId),
      eq(consumerCollectionConnection.consumerId, consumerId)
    ),
    with: {
      collection: true,
    },
  });
}

export async function createItemIdConflictResolution(
  accountId: number,
  collectionId: number,
  sourceItemId: Buffer,
  id: number
) {
  await db.insert(itemIdConflictResolution).values({
    accountId,
    collectionId,
    sourceItemId,
    id,
  });
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
