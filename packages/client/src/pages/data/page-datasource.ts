import { getDb, insertReturningId } from "../../core/db/db";
import type { DbPage, NewPage, PageUpdate } from "../../core/db/schema";
import { PageData } from "./page-data";

export async function getPages(ctx = getDb()): Promise<PageData[]> {
  const dbos = await ctx.selectFrom("page").selectAll().execute();
  return dbos.map(pageFromDb);
}

export async function createPage(
  page: Omit<PageData, "id">,
  ctx = getDb()
): Promise<PageData> {
  const id = await insertReturningId("page", pageToDb(page), ctx);
  return { ...page, id };
}

export async function updatePage(
  { id, ...data }: PageData,
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

function pageToDb<T extends PageData | Omit<PageData, "id">>(
  page: T
): T extends PageData ? PageUpdate : NewPage {
  return {
    ...page,
    collection: page.collection ?? null,
    content: page.content ? JSON.stringify(page.content) : null,
    attributes: page.attributes ? JSON.stringify(page.attributes) : null,
    author: page.author ? JSON.stringify(page.author) : null,
    updatedAt: page.updatedAt ?? null,
  } satisfies NewPage | PageUpdate as any;
}

function pageFromDb(dbo: DbPage): PageData {
  return deleteNulls({
    ...dbo,
    content: dbo.content && JSON.parse(dbo.content),
    attributes: dbo.attributes && JSON.parse(dbo.attributes),
    author: dbo.author && JSON.parse(dbo.author),
  });
}

function deleteNulls<T>(obj: T): { [K in keyof T]: Exclude<T[K], null> } {
  for (const key in obj) {
    if (obj[key] === null) {
      delete obj[key];
    }
  }
  return obj as any;
}
