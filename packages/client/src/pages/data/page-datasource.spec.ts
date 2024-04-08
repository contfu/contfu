import { beforeEach, describe, expect, it } from "bun:test";
import { getDb, insertReturningId } from "../../core/db/db";
import type { NewPage } from "../../core/db/schema";
import { Page } from "../pages";
import { PageData } from "./page-data";
import {
  createOrUpdatePage,
  createPage,
  deletePage,
  deletePagesByRefs,
  getPage,
  getPageIdsByCollection,
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

describe("getPage()", () => {
  it("should return a page by id", async () => {
    const id = await insertPage();

    const p = await getPage({ id });

    expect(p).toEqual({ ...page, id });
  });

  it("should return a page by ref", async () => {
    const id = await insertPage();

    const p = await getPage({ ref: "test" });

    expect(p).toEqual({ ...page, id });
  });

  it("should return null if there is no page", async () => {
    const p = await getPage({ id: 1 });

    expect(p).toBeNull();
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

describe("createOrUpdatePage()", () => {
  it("should create a new page, if there is no page with the same ref", async () => {
    const p = { ...page, ref: "test" };

    const { id } = await createOrUpdatePage(p);

    expect(await selectAllPages()).toEqual([{ ...newPage, id }]);
  });

  it("should update a page, if there is a page with the same ref", async () => {
    const id = await insertPage();
    const p = { ...page, title: "x" };

    await createOrUpdatePage(p);

    expect(await selectAllPages()).toEqual([{ ...newPage, title: "x", id }]);
  });
});

describe("deletePage()", () => {
  it("should delete a page", async () => {
    const id = await insertPage();

    await deletePage({ id });

    expect(await selectAllPages()).toEqual([]);
  });
});

describe("deletePagesByRefs()", () => {
  it("should delete all pages with matching refs", async () => {
    const page2 = { ...newPage, ref: "test2", slug: "test2" };
    await insertPage({ ...newPage, ref: "test1", slug: "test1" });
    const id = await insertPage(page2);
    await insertPage({ ...newPage, ref: "test3", slug: "test3" });

    await deletePagesByRefs(["test1", "test3"]);

    expect(await selectAllPages()).toEqual([{ ...page2, id }]);
  });
});

describe("getPageIdsByCollection", () => {
  it("should return an array of page ids by collection", async () => {
    const id = await insertPage();

    const ids = await getPageIdsByCollection("foo");

    expect(ids).toEqual([id]);
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
  links: { content: [] },
} satisfies Omit<PageData<Page<{ collection: "foo" }>>, "id">;

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
