import { describe, expect, it } from "bun:test";
import { getDb, insertReturningId } from "../../core/db/db";
import type { NewPage } from "../../core/db/schema";
import { PageData } from "./page-data";
import {
  createPage,
  deletePage,
  getPages,
  updatePage,
} from "./page-datasource";

describe("getPages()", () => {
  it("should return an array of pages", async () => {
    const id = await insertPage();

    const pages = await getPages();

    expect(pages).toEqual([{ ...page, id }]);
  });
});

describe("createPage()", () => {
  it("should insert a new page", async () => {
    const { id } = await createPage(page);

    expect(await selectAllPages()).toEqual([{ ...newPage, id }]);
  });
});

describe("updatePage()", () => {
  it("should update a page", async () => {
    const id = await insertPage();
    const update = { ...page, id, collection: "test2" };

    await updatePage(update);

    expect(await selectAllPages()).toEqual([
      { ...newPage, id, collection: "test2" },
    ]);
  });
});

describe("deletePage()", () => {
  it("should delete a page", async () => {
    const id = await insertPage();

    await deletePage({ id });

    expect(await selectAllPages()).toEqual([]);
  });
});

const page = {
  ref: "test",
  slug: "test",
  collection: "foo",
  title: "abc",
  description: "test",
  content: [],
  attributes: {},
  connection: 1,
  publishedAt: 0,
  createdAt: 0,
  changedAt: 0,
} satisfies Omit<PageData, "id">;

const newPage = {
  ...page,
  content: "[]",
  attributes: "{}",
  author: null,
  connection: 1,
  publishedAt: 0,
  createdAt: 0,
  updatedAt: null,
  changedAt: 0,
} satisfies NewPage;

async function insertPage(c: NewPage = newPage) {
  return await insertReturningId("page", c);
}

async function selectAllPages() {
  return await getDb().selectFrom("page").selectAll().execute();
}
