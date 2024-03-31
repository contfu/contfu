import { beforeEach, describe, expect, it } from "bun:test";
import { getDb, insertReturningId } from "../../core/db/db";
import type { NewPage } from "../../core/db/schema";
import { PageData } from "./page-data";
import {
  createPage,
  deletePage,
  getPages,
  setLinks,
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

  it("should not store links", async () => {
    await createPage({
      ...page,
      links: { foo: ["/bar"] },
    });

    expect(await selectAllPageLinks()).toEqual([]);
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

describe("setLinks()", () => {
  let from: number;
  let to: number;

  beforeEach(async () => {
    from = await insertPage();
    to = await insertPage({ ...newPage, ref: "test2", slug: "test2" });
  });

  it("should replace all outgoing links of a page by ids", async () => {
    await insertPageLink("foo", from, to);

    await setLinks(from, { bar: [to] });

    expect(await selectAllPageLinks()).toEqual([{ type: "bar", from, to }]);
  });

  it("should replace all outgoing links of a page by refs", async () => {
    await insertPageLink("foo", from, to);

    await setLinks(from, { bar: ["test2"] });

    expect(await selectAllPageLinks()).toEqual([{ type: "bar", from, to }]);
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
  links: {},
} satisfies Omit<PageData, "id">;

const {
  links: {},
  ...pageWithoutLinks
} = page;
const newPage = {
  ...pageWithoutLinks,
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

async function selectAllPageLinks() {
  return await getDb().selectFrom("pageLink").selectAll().execute();
}

async function insertPageLink(type: string, from: number, to: number) {
  await getDb().insertInto("pageLink").values({ type, from, to }).execute();
}
