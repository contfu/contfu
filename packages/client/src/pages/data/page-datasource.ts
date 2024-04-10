import { Transaction } from "kysely";
import { MarkOptional } from "ts-essentials";
import { getDb, insertReturningId } from "../../core/db/db";
import type { DbPage, NewPage, PageUpdate, Schema } from "../../core/db/schema";
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

export function setLinks(
  from: number,
  links: Record<string, (number | string)[]>,
  ctx = getDb()
) {
  return ctx instanceof Transaction
    ? doSetLinks(ctx)
    : ctx.transaction().execute(doSetLinks);

  async function doSetLinks(ctx: Transaction<Schema>) {
    await ctx.deleteFrom("pageLink").where("from", "=", from).execute();
    const resolved = await resolveSlugs(ctx);
    await ctx
      .insertInto("pageLink")
      .values(
        Object.entries(resolved).flatMap(([type, tos]) =>
          tos.map((to) => ({ from, type, to }))
        )
      )
      .execute();
  }

  async function resolveSlugs(ctx: Transaction<Schema>) {
    const linkLists = Object.values(links);
    const slugs = linkLists.flatMap((tos) =>
      tos.filter((to): to is string => typeof to === "string")
    );
    if (slugs.length > 0) {
      const deduped = Array.from(new Set(slugs));
      const slugIds = await ctx
        .selectFrom("page")
        .select(["id", "slug"])
        .where("slug", "in", deduped)
        .execute();
      for (const list of linkLists) {
        for (let i = 0; i < list.length; i++) {
          if (typeof list[i] === "string") {
            const slug = list[i];
            const id = slugIds.find((s) => s.slug === slug)?.id;
            if (id) list[i] = id;
          }
        }
      }
    }
    return links as Record<string, number[]>;
  }
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
