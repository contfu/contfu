import { beforeEach, describe, expect, it, mock } from "bun:test";
import { Connection } from "../connections/connections";
import { createConnection } from "../connections/data/connection-datasource";
import { PageData } from "../pages/data/page-data";
import {
  createPage,
  createPageLink,
  getPage,
  getPageLinks,
  getPages,
} from "../pages/data/page-datasource";
import { Page } from "../pages/pages";
import { sync } from "./sync";

let c: Connection<"foo" | "bar">;

beforeEach(async () => {
  c = await createConnection(conn);
  page.connection = c.id;
});

describe("sync()", () => {
  it("should initially pull from a connection", async () => {
    sync([c]);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should continuously pull from a connection", async () => {
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield page;
        yield { ...page, ref: "test2", slug: "test2" };
      }
    });

    sync([c]);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should create pages in the database", async () => {
    sync([c]);
    await Bun.sleep(0);

    expect(conn.pull).toHaveBeenCalled();
    expect(await getPage({ ref: "test" })).toEqual({
      id: expect.any(Number),
      ...page,
    });
  });

  it("should create new links in the database", async () => {
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield { ...page, links: { content: ["test2"] } };
        yield { ...page, collection: "bar", ref: "test2", slug: "test2" };
      }
    });

    sync([c]);
    await Bun.sleep(0);

    const page1 = await getPage({ ref: "test" });
    const page2 = await getPage({ ref: "test2" });
    expect(await getPageLinks({ from: page1!.id })).toEqual({
      content: [page2!.id],
    });
  });

  it("should create new links in the database", async () => {
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield { ...page, links: { content: ["test2"] } };
        yield { ...page, collection: "bar", ref: "test2", slug: "test2" };
        yield { ...page, links: { content: [], foo: ["test2"] } };
      }
    });

    sync([c]);
    await Bun.sleep(0);

    const page1 = await getPage({ ref: "test" });
    const page2 = await getPage({ ref: "test2" });
    expect(await getPageLinks({ from: page1!.id })).toEqual({
      content: [],
      foo: [page2!.id],
    });
  });

  it("should remove orphans with links", async () => {
    const page1 = await createPage({ ...page });
    const page2 = await createPage({ ...page, ref: "test2", slug: "test2" });
    await createPageLink({ type: "foo", from: page1.id, to: page2.id });
    conn.pull.mockImplementationOnce(async function* () {});
    conn.pullCollectionRefs.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") yield ["test2"];
    });

    sync([c]);
    await Bun.sleep(0);

    expect(await getPages()).toEqual([
      {
        ...page,
        id: page2.id,
        ref: "test2",
        slug: "test2",
      },
    ]);
    expect(await getPageLinks({ from: page1.id })).toEqual({ content: [] });
  });
});

const conn = {
  name: "foo",
  collectionNames: ["foo", "bar"],
  pullCollectionRefs: mock(async function* (collection: "foo" | "bar") {
    if (collection === "foo") yield ["test"];
  }),
  pull: mock(async function* (collection: "foo" | "bar") {
    if (collection === "foo") yield page;
  }),
} satisfies Omit<Connection<"foo" | "bar">, "id">;

const page: Omit<PageData<Page<{ collection: "foo" | "bar" }>>, "id"> = {
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
  links: { content: [] as string[] },
};
