import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { itemsTable, linkTable, type DbItem, type ItemUpdate, type NewItem } from "../../infra/db/schema";
import { getCollectionId, getCollectionName, getOrCreateCollection } from "../collections/collection-datasource";
import { deleteNulls } from "../../util/object-helpers";
import type { ItemData } from "./item-types";

export async function getItems(ctx = db): Promise<ItemData[]> {
  const dbos = await ctx.select().from(itemsTable).all();
  return Promise.all(dbos.map((dbo) => itemFromDb(dbo, undefined, ctx)));
}

export async function getItem(
  { id }: { id: string },
  ctx = db,
): Promise<Omit<ItemData, "links"> | null> {
  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, fromHex(id)))
    .all();
  return dbos.length > 0 ? itemFromDb(dbos[0], undefined, ctx) : null;
}

export async function getLastChangedItem(
  collection: string,
  ctx = db,
): Promise<Omit<ItemData, "links"> | null> {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return null;

  const dbo = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .orderBy(desc(itemsTable.changedAt))
    .limit(1)
    .all();
  return dbo.length > 0 ? itemFromDb(dbo[0], undefined, ctx) : null;
}

export async function createOrUpdateItem<T extends Omit<ItemData, "links">>(
  item: T,
  ctx = db,
): Promise<T> {
  const existing = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, fromHex(item.id)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    await updateItem(item, ctx);
    return item;
  }

  return createItem(item, ctx);
}

export async function createItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): Promise<T> {
  await ctx.insert(itemsTable).values((await itemToDb(item, ctx)) as NewItem);
  return item;
}

export async function updateItem<T extends Omit<ItemData, "links">>(item: T, ctx = db): Promise<T> {
  await ctx
    .update(itemsTable)
    .set(await itemToDb(item, ctx))
    .where(eq(itemsTable.id, fromHex(item.id)));
  return item;
}

export async function deleteItem(id: string, ctx = db): Promise<void> {
  await ctx.delete(itemsTable).where(eq(itemsTable.id, fromHex(id)));
}

export async function deleteItemsByIds(ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  for (const id of ids) {
    await ctx.delete(itemsTable).where(eq(itemsTable.id, fromHex(id)));
  }
}

export async function getItemIdsByCollection(collection: string, ctx = db): Promise<string[]> {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return [];

  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .all();
  return dbos.map((dbo) => toHex(dbo.id));
}

export async function getItemLinks(
  opts: Partial<{ type: string; from: string; to: string }>,
  ctx = db,
): Promise<Record<string, string[]> & { content: string[] }> {
  const dbos = await ctx
    .select()
    .from(linkTable)
    .where(
      and(
        opts.type ? eq(linkTable.type, opts.type) : undefined,
        opts.from ? eq(linkTable.from, fromHex(opts.from)) : undefined,
        opts.to ? eq(linkTable.to, fromHex(opts.to)) : undefined,
      ),
    )
    .all();

  const links = { content: [] } as Record<string, string[]> & { content: string[] };
  for (const { type, from, to } of dbos) {
    if (!links[type]) links[type] = [];
    links[type].push(toHex("to" in opts ? from : to));
  }
  return links;
}

export async function createItemLink(
  { type, from, to }: { type: string; from: string; to: string },
  ctx = db,
): Promise<void> {
  await ctx.insert(linkTable).values({
    type,
    from: fromHex(from),
    to: fromHex(to),
  });
}

export async function deleteOutgoingItemLinks(from: string, ctx = db): Promise<void> {
  await ctx.delete(linkTable).where(eq(linkTable.from, fromHex(from)));
}

export async function deleteItemLinksByRef(id: string, ctx = db): Promise<void> {
  const idBlob = fromHex(id);
  await ctx.delete(linkTable).where(or(eq(linkTable.from, idBlob), eq(linkTable.to, idBlob)));
}

async function itemToDb<T extends ItemData | Omit<ItemData, "links">>(
  item: T,
  ctx = db,
): Promise<ItemUpdate | NewItem> {
  const collectionId = item.collection
    ? await getOrCreateCollection(item.collection, ctx)
    : undefined;
  return {
    id: fromHex(item.id),
    ref: item.ref,
    collection: collectionId,
    props: item.props ? JSON.stringify(item.props) : null,
    content: item.content ? JSON.stringify(item.content) : null,
    changedAt: item.changedAt,
  } satisfies ItemUpdate as ItemUpdate | NewItem;
}

async function itemFromDb(
  dbo: DbItem,
  links?: Record<string, string[]> & { content: string[] },
  ctx = db,
): Promise<ItemData> {
  const collectionName = dbo.collection ? await getCollectionName(dbo.collection, ctx) : "";
  return deleteNulls({
    id: toHex(dbo.id),
    ref: dbo.ref,
    collection: collectionName,
    props: dbo.props ? JSON.parse(dbo.props) : {},
    content: dbo.content ? JSON.parse(dbo.content) : undefined,
    changedAt: dbo.changedAt,
    links: links ?? { content: [] },
  });
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function toHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/** @deprecated Use getItems instead. */
export const getPages = getItems;
/** @deprecated Use getItem instead. */
export const getPage = getItem;
/** @deprecated Use getLastChangedItem instead. */
export const getLastChangedPage = getLastChangedItem;
/** @deprecated Use createOrUpdateItem instead. */
export const createOrUpdatePage = createOrUpdateItem;
/** @deprecated Use createItem instead. */
export const createPage = createItem;
/** @deprecated Use updateItem instead. */
export const updatePage = updateItem;
/** @deprecated Use deleteItem instead. */
export const deletePage = deleteItem;
/** @deprecated Use deleteItemsByIds instead. */
export const deletePagesByIds = deleteItemsByIds;
/** @deprecated Use getItemIdsByCollection instead. */
export const getPageIdsByCollection = getItemIdsByCollection;
/** @deprecated Use getItemLinks instead. */
export const getPageLinks = getItemLinks;
/** @deprecated Use createItemLink instead. */
export const createPageLink = createItemLink;
/** @deprecated Use deleteOutgoingItemLinks instead. */
export const deleteOutgoingPageLinks = deleteOutgoingItemLinks;
/** @deprecated Use deleteItemLinksByRef instead. */
export const deletePageLinksByRef = deleteItemLinksByRef;
