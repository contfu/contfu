import { PageData } from "@contfu/core";
import { MarkOptional } from "ts-essentials";
import { fromHex, getDb, toHex } from "../../core/db/db";
import type { DbPage, NewPage, PageUpdate } from "../../core/db/schema";
import { deleteNulls } from "../../util/object-helpers";

export async function getPages(ctx = getDb()): Promise<PageData[]> {
  const dbos = await ctx.selectFrom("page").selectAll().execute();
  return dbos.map((dbo) => pageFromDb(dbo));
}

export async function getPage(
  { id, path }: { id?: string; path?: string },
  ctx = getDb()
): Promise<Omit<PageData, "links"> | null> {
  const dbos = await ctx
    .selectFrom("page")
    .selectAll()
    .where((eb) => eb.and({ id: id ? fromHex(id) : undefined, path }))
    .execute();
  return dbos.length > 0 ? pageFromDb(dbos[0]) : null;
}

export async function getLastChangedPage(
  connection: string,
  collection: string,
  ctx = getDb()
): Promise<Omit<PageData, "links"> | null> {
  const dbo = await ctx
    .selectFrom("page")
    .selectAll()
    .where((eb) => eb.and({ connection: fromHex(connection), collection }))
    .orderBy("changedAt", "desc")
    .limit(1)
    .executeTakeFirst();
  return dbo ? pageFromDb(dbo) : null;
}

export async function createOrUpdatePage<T extends Omit<PageData, "links">>(
  page: T,
  ctx = getDb()
): Promise<T> {
  const existing = await ctx
    .selectFrom("page")
    .select(["id"])
    .where("id", "=", fromHex(page.id))
    .executeTakeFirst();
  if (existing) {
    await updatePage(page, ctx);
    return page;
  } else {
    return createPage(page, ctx);
  }
}

export async function createPage<T extends Omit<PageData, "links">>(
  page: T,
  ctx = getDb()
): Promise<T> {
  await ctx
    .insertInto("page")
    .values(pageToDb(page) as NewPage)
    .execute();
  return page;
}

export async function updatePage<T extends Omit<PageData, "links">>(
  page: T,
  ctx = getDb()
): Promise<T> {
  await ctx
    .updateTable("page")
    .set(pageToDb(page))
    .where("id", "=", fromHex(page.id))
    .execute();
  return page;
}

export async function deletePage(
  { id, path }: Partial<Pick<PageData, "id" | "path">>,
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("page")
    .where((eb) => eb.and({ id: id ? fromHex(id) : undefined, path }))
    .execute();
}

export async function deletePagesByIds(
  connection: string,
  ids: string[],
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("page")
    .where((eb) =>
      eb.and([
        eb("connection", "=", fromHex(connection)),
        eb("id", "in", ids.map(fromHex)),
      ])
    )
    .execute();
}

export async function getPageIdsByCollection(
  connection: string,
  collection: string,
  ctx = getDb()
) {
  const dbos = await ctx
    .selectFrom("page")
    .select("id")
    .where((eb) => eb.and({ connection: fromHex(connection), collection }))
    .execute();
  const refs = dbos.map((dbo) => toHex(dbo.id));
  return refs;
}

export async function getPageLinks(
  opts: Partial<{ type: string; from: string; to: string }>,
  ctx = getDb()
) {
  const dbos = await ctx
    .selectFrom("pageLink")
    .selectAll()
    .where((eb) =>
      eb.and({
        type: opts.type,
        from: opts.from ? fromHex(opts.from) : undefined,
        to: opts.to ? fromHex(opts.to) : undefined,
      })
    )
    .execute();
  const links = { content: [] } as Record<string, string[]>;
  for (const { type, from, to } of dbos) {
    if (!links[type]) links[type] = [];
    links[type].push(toHex("to" in opts ? from : to));
  }
  return links;
}

export async function createPageLink(
  { type, from, to }: { type: string; from: string; to: string },
  ctx = getDb()
): Promise<void> {
  await ctx
    .insertInto("pageLink")
    .values({ type, from: fromHex(from), to: fromHex(to) })
    .execute();
}

export async function deleteOutgoingPageLinks(
  from: string,
  ctx = getDb()
): Promise<void> {
  await ctx.deleteFrom("pageLink").where("from", "=", fromHex(from)).execute();
}

export async function deletePageLinksByRef(id: string, ctx = getDb()) {
  await ctx
    .deleteFrom("pageLink")
    .where((eb) => eb.or({ from: fromHex(id), to: fromHex(id) }))
    .execute();
}

function pageToDb<T extends PageData | MarkOptional<PageData, "links">>({
  links,
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
  links?: Record<string, string[]> & { content: string[] }
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
