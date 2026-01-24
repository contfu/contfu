import { and, desc, eq, or } from "drizzle-orm";
import { MarkOptional } from "ts-essentials";
import { db } from "../db/db";
import { itemsTable, linkTable, type DbItem, type ItemUpdate, type NewItem } from "../db/schema";
import { deleteNulls } from "../util/object-helpers";
import type { PageData } from "./pages";

export async function getPages(ctx = db): Promise<PageData[]> {
  const dbos = await ctx.select().from(itemsTable).all();
  return dbos.map((dbo) => pageFromDb(dbo));
}

export async function getPage(
  { id, path }: { id?: string; path?: string },
  ctx = db,
): Promise<Omit<PageData, "links"> | null> {
  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(
      and(
        id ? eq(itemsTable.id, fromHex(id)) : undefined,
        path ? eq(itemsTable.path, path) : undefined,
      ),
    )
    .all();
  return dbos.length > 0 ? pageFromDb(dbos[0]) : null;
}

export async function getLastChangedPage(
  connection: string,
  collection: string,
  ctx = db,
): Promise<Omit<PageData, "links"> | null> {
  const dbo = await ctx
    .select()
    .from(itemsTable)
    .where(
      and(eq(itemsTable.connection, fromHex(connection)), eq(itemsTable.collection, collection)),
    )
    .orderBy(desc(itemsTable.changedAt))
    .limit(1)
    .all();
  return dbo.length > 0 ? pageFromDb(dbo[0]) : null;
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
  await ctx.insert(itemsTable).values(pageToDb(page) as NewItem);
  return page;
}

export async function updatePage<T extends Omit<PageData, "links">>(page: T, ctx = db): Promise<T> {
  await ctx
    .update(itemsTable)
    .set(pageToDb(page))
    .where(eq(itemsTable.id, fromHex(page.id)));
  return page;
}

export async function deletePage(
  { id, path }: Partial<Pick<PageData, "id" | "path">>,
  ctx = db,
): Promise<void> {
  if (id) {
    await ctx.delete(itemsTable).where(eq(itemsTable.id, fromHex(id)));
  } else if (path) {
    await ctx.delete(itemsTable).where(eq(itemsTable.path, path));
  }
}

export async function deletePagesByIds(connection: string, ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  const connectionBlob = fromHex(connection);
  for (const id of ids) {
    await ctx
      .delete(itemsTable)
      .where(and(eq(itemsTable.connection, connectionBlob), eq(itemsTable.id, fromHex(id))));
  }
}

export async function getPageIdsByCollection(connection: string, collection: string, ctx = db) {
  const dbos = await ctx
    .select()
    .from(itemsTable)
    .where(
      and(eq(itemsTable.connection, fromHex(connection)), eq(itemsTable.collection, collection)),
    )
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

function pageToDb<T extends PageData | MarkOptional<PageData, "links">>({
  links: _links,
  ...page
}: T): ItemUpdate | NewItem {
  return {
    ...page,
    id: fromHex(page.id),
    connection: fromHex(page.connection),
    collection: page.collection ?? null,
    content: page.content ? JSON.stringify(page.content) : null,
    props: page.props ? JSON.stringify(page.props) : null,
    author: page.author ? JSON.stringify(page.author) : null,
    updatedAt: page.updatedAt ?? null,
  } satisfies ItemUpdate as any;
}

function pageFromDb(
  dbo: DbItem,
  links?: Record<string, string[]> & { content: string[] },
): PageData {
  return deleteNulls({
    ...dbo,
    id: toHex(dbo.id),
    connection: toHex(dbo.connection),
    content: dbo.content && JSON.parse(dbo.content),
    props: dbo.props && JSON.parse(dbo.props),
    author: dbo.author && JSON.parse(dbo.author),
    links: links ?? { content: [] },
  });
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function toHex(buffer: Buffer): string {
  return buffer.toString("hex");
}
