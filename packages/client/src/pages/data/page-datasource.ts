import { MarkOptional } from "ts-essentials";
import { getDb, insertReturningId } from "../../core/db/db";
import type {
  DbPage,
  DbPageLink,
  NewPage,
  PageUpdate,
} from "../../core/db/schema";
import { deleteNulls } from "../../util/object-helpers";
import { PageData } from "./page-data";

export async function getPages(ctx = getDb()): Promise<PageData[]> {
  const dbos = await ctx.selectFrom("page").selectAll().execute();
  return dbos.map((dbo) => pageFromDb(dbo));
}

export async function getPage(
  { id, ref }: { id?: number; ref?: string },
  ctx = getDb()
): Promise<Omit<PageData, "links"> | null> {
  const dbos = await ctx
    .selectFrom("page")
    .selectAll()
    .where((eb) => eb.and({ id, ref }))
    .execute();
  return dbos.length > 0 ? pageFromDb(dbos[0]) : null;
}

export async function getLastChangedPage(
  connection: number,
  collection: string,
  ctx = getDb()
): Promise<Omit<PageData, "links"> | null> {
  const dbo = await ctx
    .selectFrom("page")
    .selectAll()
    .where((eb) => eb.and({ connection, collection }))
    .orderBy("changedAt", "desc")
    .limit(1)
    .executeTakeFirst();
  return dbo ? pageFromDb(dbo) : null;
}

export async function createOrUpdatePage(
  page: Omit<PageData, "id" | "links">,
  ctx = getDb()
): Promise<Omit<PageData, "links">> {
  const existing = await ctx
    .selectFrom("page")
    .select(["id"])
    .where("ref", "=", page.ref)
    .executeTakeFirst();
  if (existing) {
    const id = existing.id;
    const update = { ...page, id };
    await updatePage(update, ctx);
    return update;
  } else {
    return createPage(page, ctx);
  }
}

export async function createPage(
  page: Omit<PageData, "id" | "links">,
  ctx = getDb()
): Promise<Omit<PageData, "links">> {
  const id = await insertReturningId("page", pageToDb(page), ctx);
  return { ...page, id };
}

export async function updatePage(
  { id, ...data }: Omit<PageData, "links">,
  ctx = getDb()
): Promise<void> {
  await ctx
    .updateTable("page")
    .set(pageToDb(data))
    .where("id", "=", id)
    .execute();
}

export async function deletePage(
  part: Partial<Pick<DbPage, "id" | "slug">>,
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("page")
    .where((eb) => eb.and(part))
    .execute();
}

export async function deletePagesByRefs(
  connection: number,
  refs: string[],
  ctx = getDb()
): Promise<void> {
  await ctx
    .deleteFrom("page")
    .where((eb) =>
      eb.and([eb("connection", "=", connection), eb("ref", "in", refs)])
    )
    .execute();
}

export async function getPageRefsByCollection(
  connection: number,
  collection: string,
  ctx = getDb()
) {
  const dbos = await ctx
    .selectFrom("page")
    .select("ref")
    .where((eb) => eb.and({ connection, collection }))
    .execute();
  const refs = dbos.map((dbo) => dbo.ref);
  return refs;
}

export async function getPageLinks(opts: Partial<DbPageLink>, ctx = getDb()) {
  const dbos = await ctx
    .selectFrom("pageLink")
    .selectAll()
    .where((eb) => eb.and(opts))
    .execute();
  const links = { content: [] } as Record<string, number[]>;
  for (const { type, from, to } of dbos) {
    if (!links[type]) links[type] = [];
    links[type].push("to" in opts ? from : to);
  }
  return links;
}

export async function createPageLink(
  link: DbPageLink,
  ctx = getDb()
): Promise<void> {
  await ctx.insertInto("pageLink").values(link).execute();
}

export async function deleteOutgoingPageLinks(
  from: number,
  ctx = getDb()
): Promise<void> {
  await ctx.deleteFrom("pageLink").where("from", "=", from).execute();
}

export async function deletePageLinksByRef(ref: string, ctx = getDb()) {
  const page = await getPage({ ref }, ctx);
  if (!page) return;
  await ctx
    .deleteFrom("pageLink")
    .where((eb) => eb.or([eb("from", "=", page.id), eb("to", "=", page.id)]))
    .execute();
}

function pageToDb<T extends PageData | MarkOptional<PageData, "id" | "links">>({
  links,
  ...page
}: T): T extends PageData ? PageUpdate : NewPage {
  return {
    ...page,
    collection: page.collection ?? null,
    content: page.content ? JSON.stringify(page.content) : null,
    attributes: page.attributes ? JSON.stringify(page.attributes) : null,
    author: page.author ? JSON.stringify(page.author) : null,
    updatedAt: page.updatedAt ?? null,
  } satisfies NewPage | PageUpdate as any;
}

function pageFromDb(
  dbo: DbPage,
  links?: Record<string, string[]> & { content: string[] }
): PageData {
  return deleteNulls({
    ...dbo,
    content: dbo.content && JSON.parse(dbo.content),
    attributes: dbo.attributes && JSON.parse(dbo.attributes),
    author: dbo.author && JSON.parse(dbo.author),
    links: links ?? { content: [] },
  });
}
