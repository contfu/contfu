import type { PageData } from "../pages";
import { and, desc, eq, or } from "drizzle-orm";
import { MarkOptional } from "ts-essentials";
import { db } from "../../core/db/db";
import {
  pageLinkTable,
  pageTable,
  type DbPage,
  type NewPage,
  type PageUpdate,
} from "../../core/db/schema";
import { deleteNulls } from "../../util/object-helpers";

export async function getPages(ctx = db): Promise<PageData[]> {
  const dbos = await ctx.select().from(pageTable).all();
  return dbos.map((dbo) => pageFromDb(dbo));
}

export async function getPage(
  { id, path }: { id?: string; path?: string },
  ctx = db,
): Promise<Omit<PageData, "links"> | null> {
  const dbos = await ctx
    .select()
    .from(pageTable)
    .where(
      and(
        id ? eq(pageTable.id, fromHex(id)) : undefined,
        path ? eq(pageTable.path, path) : undefined,
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
    .from(pageTable)
    .where(and(eq(pageTable.connection, fromHex(connection)), eq(pageTable.collection, collection)))
    .orderBy(desc(pageTable.changedAt))
    .limit(1)
    .all();
  return dbo.length > 0 ? pageFromDb(dbo[0]) : null;
}

export async function createOrUpdatePage<T extends Omit<PageData, "links">>(
  page: T,
  ctx = db,
): Promise<T> {
  const existing = await ctx
    .select({ id: pageTable.id })
    .from(pageTable)
    .where(eq(pageTable.id, fromHex(page.id)))
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
  await ctx.insert(pageTable).values(pageToDb(page) as NewPage);
  return page;
}

export async function updatePage<T extends Omit<PageData, "links">>(page: T, ctx = db): Promise<T> {
  await ctx
    .update(pageTable)
    .set(pageToDb(page))
    .where(eq(pageTable.id, fromHex(page.id)));
  return page;
}

export async function deletePage(
  { id, path }: Partial<Pick<PageData, "id" | "path">>,
  ctx = db,
): Promise<void> {
  if (id) {
    await ctx.delete(pageTable).where(eq(pageTable.id, fromHex(id)));
  } else if (path) {
    await ctx.delete(pageTable).where(eq(pageTable.path, path));
  }
}

export async function deletePagesByIds(connection: string, ids: string[], ctx = db): Promise<void> {
  if (ids.length === 0) return;

  const connectionBlob = fromHex(connection);
  for (const id of ids) {
    await ctx
      .delete(pageTable)
      .where(and(eq(pageTable.connection, connectionBlob), eq(pageTable.id, fromHex(id))));
  }
}

export async function getPageIdsByCollection(connection: string, collection: string, ctx = db) {
  const dbos = await ctx
    .select({ id: pageTable.id })
    .from(pageTable)
    .where(and(eq(pageTable.connection, fromHex(connection)), eq(pageTable.collection, collection)))
    .all();
  return dbos.map((dbo) => toHex(dbo.id));
}

export async function getPageLinks(
  opts: Partial<{ type: string; from: string; to: string }>,
  ctx = db,
) {
  const dbos = await ctx
    .select()
    .from(pageLinkTable)
    .where(
      and(
        opts.type ? eq(pageLinkTable.type, opts.type) : undefined,
        opts.from ? eq(pageLinkTable.from, fromHex(opts.from)) : undefined,
        opts.to ? eq(pageLinkTable.to, fromHex(opts.to)) : undefined,
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
  await ctx.insert(pageLinkTable).values({
    type,
    from: fromHex(from),
    to: fromHex(to),
  });
}

export async function deleteOutgoingPageLinks(from: string, ctx = db): Promise<void> {
  await ctx.delete(pageLinkTable).where(eq(pageLinkTable.from, fromHex(from)));
}

export async function deletePageLinksByRef(id: string, ctx = db) {
  const idBlob = fromHex(id);
  await ctx
    .delete(pageLinkTable)
    .where(or(eq(pageLinkTable.from, idBlob), eq(pageLinkTable.to, idBlob)));
}

function pageToDb<T extends PageData | MarkOptional<PageData, "links">>({
  _links,
  ...page
}: T): PageUpdate | NewPage {
  return {
    ...page,
    id: fromHex(page.id),
    connection: fromHex(page.connection),
    collection: page.collection ?? null,
    content: page.content ? JSON.stringify(page.content) : null,
    props: page.props ? JSON.stringify(page.props) : null,
    author: page.author ? JSON.stringify(page.author) : null,
    updatedAt: page.updatedAt ?? null,
  } satisfies PageUpdate as any;
}

function pageFromDb(
  dbo: DbPage,
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
