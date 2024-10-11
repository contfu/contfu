import { SourceConfig } from "@contfu/core";
import { and, eq, sql } from "drizzle-orm";
import { withSchema } from "../../core/db";
import {
  clientCollectionConnection,
  ClientCollectionState,
  Collection,
  collection,
  itemIdConflictResolution,
  Source,
  source,
} from "./data-db";
const db = withSchema({ source, collection, itemIdConflictResolution });

export async function createSource(
  accountId: number,
  name: string,
  config: SourceConfig
): Promise<Source> {
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
        key: Buffer.from(config.key, "base64url"),
        opts: {},
      })
      .returning()
  )[0];
}

export async function createCollection(
  accountId: number,
  sourceId: number,
  name: string,
  opts?: Record<string, any>
): Promise<Collection> {
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

export async function createClientCollectionConnection(
  accountId: number,
  clientId: number,
  collectionId: number
): Promise<ClientCollectionState> {
  return (
    await db
      .insert(clientCollectionConnection)
      .values({
        accountId,
        clientId,
        collectionId,
        ids: Buffer.from([]),
      })
      .returning()
  )[0];
}

export async function createItemIdConflictResolution(
  accountId: number,
  collectionId: number,
  sourceItemId: Buffer,
  id: number
): Promise<void> {
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
): Promise<number> {
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
