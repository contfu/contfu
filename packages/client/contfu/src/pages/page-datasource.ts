import { and, desc, eq, or } from "drizzle-orm";
import { db } from "../db/db";
import { itemsTable, linkTable, type DbItem, type ItemUpdate, type NewItem } from "../db/schema";
import {
  getCollectionId,
  getCollectionName,
  getOrCreateCollection,
} from "../features/collections/collection-datasource";
import { deleteNulls } from "../util/object-helpers";
import type { PageData } from "./pages";

export async function getPages(ctx = db): Promise<PageData[]> {
  const dbos = await ctx.select().from(itemsTable).all();
  return Promise.all(dbos.map((dbo) => pageFromDb(dbo, undefined, ctx)));
}

export async function getPage(
  { id }: { id: string },
  ctx = db,
): Promise<Omit<PageData, "links"> | null> {
  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, fromHex(id)))
    .all();
  return dbos.length > 0 ? pageFromDb(dbos[0], undefined, ctx) : null;
}

export async function getLastChangedPage(
  collection: string,
  ctx = db,
): Promise<Omit<PageData, "links"> | null> {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return null;

  const dbo = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .orderBy(desc(itemsTable.changedAt))
    .limit(1)
    .all();
  return dbo.length > 0 ? pageFromDb(dbo[0], undefined, ctx) : null;
}

export async function createOrUpdatePage<T extends Omit<PageData, "links">>(
  page: T,
  ctx = db,
): Promise<T> {
  const existing = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.id, fromHex(page.id)))
    .limit(1)
    .all();

  if (existing.length > 0) {
    await updatePage(page, ctx);
    return page;
  } else {
    return createPage(page, ctx);
  }
}

export async function createPage<T extends Omit<PageData, "links">>(page: T, ctx = db): Promise<T> {
  await ctx.insert(itemsTable).values((await pageToDb(page, ctx)) as NewItem);
  return page;
}

export async function updatePage<T extends Omit<PageData, "links">>(page: T, ctx = db): Promise<T> {
  await ctx
    .update(itemsTable)
    .set(await pageToDb(page, ctx))
    .where(eq(itemsTable.id, fromHex(page.id)));
  return page;
}

export async function deletePage(id: string, ctx = db): Promise<void> {
  await ctx.delete(itemsTable).where(eq(itemsTable.id, fromHex(id)));
}

export async function deletePagesByIds(ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await ctx.delete(itemsTable).where(eq(itemsTable.id, fromHex(id)));
  }
}

export async function getPageIdsByCollection(collection: string, ctx = db) {
  const collectionId = await getCollectionId(collection, ctx);
  if (collectionId === null) return [];

  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(eq(itemsTable.collection, collectionId))
    .all();
  return dbos.map((dbo) => toHex(dbo.id));
}

export async function getPageLinks(
  opts: Partial<{ type: string; from: string; to: string }>,
  ctx = db,
) {
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
  const links = { content: [] } as Record<string, string[]>;
  for (const { type, from, to } of dbos) {
    if (!links[type]) links[type] = [];
    links[type].push(toHex("to" in opts ? from : to));
  }
  return links;
}

export async function createPageLink(
  { type, from, to }: { type: string; from: string; to: string },
  ctx = db,
): Promise<void> {
  await ctx.insert(linkTable).values({
    type,
    from: fromHex(from),
    to: fromHex(to),
  });
}

export async function deleteOutgoingPageLinks(from: string, ctx = db): Promise<void> {
  await ctx.delete(linkTable).where(eq(linkTable.from, fromHex(from)));
}

export async function deletePageLinksByRef(id: string, ctx = db) {
  const idBlob = fromHex(id);
  await ctx.delete(linkTable).where(or(eq(linkTable.from, idBlob), eq(linkTable.to, idBlob)));
}

async function pageToDb<T extends PageData | Omit<PageData, "links">>(
  page: T,
  ctx = db,
): Promise<ItemUpdate | NewItem> {
  const collectionId = page.collection ? await getOrCreateCollection(page.collection, ctx) : null;
  return {
    id: fromHex(page.id),
    ref: page.ref,
    collection: collectionId,
    props: page.props ? JSON.stringify(page.props) : null,
    content: page.content ? JSON.stringify(page.content) : null,
    changedAt: page.changedAt,
  } satisfies ItemUpdate as any;
}

async function pageFromDb(
  dbo: DbItem,
  links?: Record<string, string[]> & { content: string[] },
  ctx = db,
): Promise<PageData> {
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
