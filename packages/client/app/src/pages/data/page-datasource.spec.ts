import { Page, PageData } from "@contfu/core";
import { beforeEach, describe, expect, it } from "bun:test";
import { db } from "../../core/db/db";
import { pageLinkTable, pageTable, type NewPage } from "../../core/db/schema";
import {
  createOrUpdatePage,
  createPage,
  createPageLink,
  deleteOutgoingPageLinks,
  deletePage,
  deletePageLinksByRef,
  deletePagesByIds,
  getPage,
  getPageIdsByCollection,
  getPageLinks,
  getPages,
  updatePage,
} from "./page-datasource";

const id1 = "1234";
const id2 = "2234";
const id3 = "3234";

describe("getPages()", () => {
  it("should return an array of pages", async () => {
    await insertPage();

    const pages = await getPages();

    expect(pages).toEqual([page]);
  });
});

describe("getPage()", () => {
  it("should return a page by id", async () => {
    await insertPage();

    const p = await getPage({ id: id1 });

    expect(p).toEqual(page);
  });

  it("should return a page by path", async () => {
    await insertPage();

    const p = await getPage({ path: "test" });

    expect(p).toEqual(page);
  });

  it("should return null if there is no page", async () => {
    const p = await getPage({ id: "aa" });

    expect(p).toBeNull();
  });
});

describe("createPage()", () => {
  it("should insert a new page", async () => {
    await createPage(page);

    expect(await selectAllPages()).toEqual([dbPage]);
  });

  it("should not store links", async () => {
    await createPage(page);

    expect(await selectAllPageLinks()).toEqual([]);
  });
});

describe("updatePage()", () => {
  it("should update a page", async () => {
    await insertPage();
    const update = { ...page, collection: "test2" };

    await updatePage(update);

    expect(await selectAllPages()).toEqual([{ ...dbPage, collection: "test2" }]);
  });
});

describe("createOrUpdatePage()", () => {
  it("should create a new page, if there is no page with the same ref", async () => {
    await createOrUpdatePage(page);

    expect(await selectAllPages()).toEqual([dbPage]);
  });

  it("should update a page, if there is a page with the same ref", async () => {
    await insertPage();
    const p = { ...page, title: "x" };

    await createOrUpdatePage(p);

    expect(await selectAllPages()).toEqual([{ ...dbPage, title: "x" }]);
  });
});

describe("deletePage()", () => {
  it("should delete a page", async () => {
    await insertPage();

    await deletePage({ id: id1 });

    expect(await selectAllPages()).toEqual([]);
  });

  it("should delete all links of a page", async () => {
    await insertPage();
    await insertPage({ ...dbPage, id: fromHex(id2), path: "test2" });
    await insertPageLink("foo", id1, id2);
    await insertPageLink("foo", id2, id1);

    await deletePage({ id: id1 });

    expect(await selectAllPageLinks()).toEqual([]);
  });
});

describe("deletePagesByIds()", () => {
  it("should delete all pages with matching refs", async () => {
    const page2 = { ...dbPage, id: fromHex(id2), path: "test2" };
    await insertPage({ ...dbPage, path: "test1" });
    await insertPage(page2);
    await insertPage({ ...dbPage, id: fromHex(id3), path: "test3" });

    await deletePagesByIds(page.connection, [id1, id3]);

    expect(await selectAllPages()).toEqual([page2]);
  });
});

describe("getPageRefsByCollection()", () => {
  it("should return an array of page ids by collection", async () => {
    await insertPage();

    const ids = await getPageIdsByCollection(page.connection, "foo");

    expect(ids).toEqual([id1]);
  });
});

describe("createPageLink()", () => {
  it("should create a page link", async () => {
    await insertPage({ ...dbPage });
    await insertPage({
      ...dbPage,
      id: fromHex(id2),
      path: "test2",
    });
    const link = { type: "foo", from: id1, to: id2 };

    await createPageLink(link);

    expect(await selectAllPageLinks()).toEqual([{ ...link, from: fromHex(id1), to: fromHex(id2) }]);
  });
});

describe("getPageLinks()", () => {
  beforeEach(async () => {
    await insertPage({ ...dbPage });
    await insertPage({ ...dbPage, id: fromHex(id2), path: "test2" });
    await insertPage({ ...dbPage, id: fromHex(id3), path: "test3" });
  });

  it("should get all outgoing links to a page", async () => {
    await insertPageLink("foo", id1, id2);
    await insertPageLink("foo", id1, id3);
    await insertPageLink("foo", id2, id1);

    expect(await getPageLinks({ from: id1 })).toEqual({
      content: [],
      foo: [id2, id3],
    });
  });

  it("should get all incoming links to a page", async () => {
    await insertPageLink("foo", id1, id2);
    await insertPageLink("foo", id1, id3);
    await insertPageLink("foo", id2, id1);

    expect(await getPageLinks({ to: id1 })).toEqual({
      content: [],
      foo: [id2],
    });
  });
});

describe("deleteOutgoingPageLinks()", () => {
  it("should delete all outgoing links of a page", async () => {
    await insertPage(dbPage);
    await insertPage({ ...dbPage, id: fromHex(id2), path: "test2" });
    await insertPageLink("foo", id1, id2);

    await deleteOutgoingPageLinks(id1);

    expect(await selectAllPageLinks()).toEqual([]);
  });
});

describe("deletePageLinksByRef()", () => {
  it("should delete all links of a page", async () => {
    await insertPage(dbPage);
    await insertPage({ ...dbPage, id: fromHex(id2), path: "test2" });
    await insertPage({ ...dbPage, id: fromHex(id3), path: "test3" });
    await insertPageLink("foo", id1, id2);
    await insertPageLink("foo", id1, id3);
    await insertPageLink("bar", id2, id1);

    await deletePageLinksByRef(id2);

    expect(await selectAllPageLinks()).toEqual([
      { type: "foo", from: fromHex(id1), to: fromHex(id3) },
    ]);
  });
});

const page = {
  id: id1,
  connection: "1234567890abcdef",
  path: "test",
  collection: "foo",
  title: "abc",
  description: "test",
  content: [],
  props: {},
  publishedAt: 0,
  createdAt: 0,
  changedAt: 0,
  links: { content: [] },
} satisfies PageData<Page>;

const { _links, _connection, ...pageWithoutLinks } = page;

const dbPage = {
  ...pageWithoutLinks,
  id: fromHex(page.id),
  connection: fromHex(page.connection),
  content: "[]",
  props: "{}",
  author: null,
  publishedAt: 0,
  createdAt: 0,
  updatedAt: null,
  changedAt: 0,
} satisfies NewPage;

async function insertPage(c: NewPage = dbPage) {
  await db
    .insert(pageTable)
    .values({ ...c })
    .execute();
}

async function selectAllPages() {
  return await db.select().from(pageTable).all();
}

async function selectAllPageLinks() {
  return await db.select().from(pageLinkTable).all();
}

async function insertPageLink(type: string, from: string, to: string) {
  await db
    .insert(pageLinkTable)
    .values({ type, from: fromHex(from), to: fromHex(to) })
    .execute();
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}
