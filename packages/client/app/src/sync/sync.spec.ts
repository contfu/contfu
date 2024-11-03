import type { ImageBlock } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Connection } from "../connections/connections";
import { createConnection } from "../connections/data/connection-datasource";
import { hashId } from "../core/crypto";
import type { MediaStore } from "../media/media";
import type { PageData } from "../pages/data/page-data";
import {
  createPage,
  createPageLink,
  getPage,
  getPageLinks,
  getPages,
} from "../pages/data/page-datasource";
import type { Page } from "../pages/pages";
import { sync } from "./sync";

let c: Connection<"foo" | "bar">;

beforeEach(async () => {
  c = await createConnection(conn);
  page.connection = c.id;
});

describe("sync()", () => {
  it("should initially pull from a connection", async () => {
    await sync([c]);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should continuously pull from a connection", async () => {
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield { page, assets: [] };
        yield { page: { ...page, ref: "test2", path: "test2" }, assets: [] };
      }
    });

    await sync([c]);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should create pages in the database", async () => {
    await sync([c]);

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
        yield { page: { ...page, links: { content: ["test2"] } }, assets: [] };
        yield {
          page: { ...page, collection: "bar", ref: "test2", path: "test2" },
          assets: [],
        };
      }
    });

    await sync([c]);

    const page1 = await getPage({ ref: "test" });
    const page2 = await getPage({ ref: "test2" });
    expect(await getPageLinks({ from: page1!.id })).toEqual({
      content: [page2!.id],
    });
  });

  it("should update links in the database", async () => {
    const page1 = await createPage({ ...page });
    const page2 = await createPage({ ...page, ref: "test2", path: "test2" });
    await createPageLink({ type: "content", from: page1.id, to: page2.id });
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield {
          page: { ...page, links: { content: [], foo: ["test2"] } },
          assets: [],
        };
      }
    });
    conn.pullCollectionRefs.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") yield ["test", "test2"];
    });

    await sync([c]);

    expect(await getPageLinks({ from: page1!.id })).toEqual({
      content: [],
      foo: [page2!.id],
    });
  });

  it("should store assets", async () => {
    const block = ["i", "/test.jpg", "test"] satisfies ImageBlock;
    conn.pull.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") {
        yield {
          page: { ...page, content: block },
          assets: [{ block, ref: "/test-ref.jpg" }],
        };
      }
    });
    const hash = await hashId(`${c.id}|/test-ref.jpg`);

    await sync([c]);

    expect(conn.mediaStore.exists).toHaveBeenCalledWith(hash);
    expect(conn.fetchAsset).toHaveBeenCalledWith("/test.jpg");
    expect(conn.mediaOptimizer.optimizeImage).toHaveBeenCalledWith(
      conn.mediaStore,
      `${hash}.jpg`,
      conn.fetchAsset.mock.results[0].value
    );
    expect(block).toEqual(["i", `${hash}.jpg`, "test"]);
  });

  it("should remove orphans with links", async () => {
    const page1 = await createPage({ ...page });
    const page2 = await createPage({ ...page, ref: "test2", path: "test2" });
    await createPageLink({ type: "foo", from: page1.id, to: page2.id });
    conn.pull.mockImplementationOnce(async function* () {});
    conn.pullCollectionRefs.mockImplementationOnce(async function* (
      collection: "foo" | "bar"
    ) {
      if (collection === "foo") yield ["test2"];
    });

    await sync([c]);

    expect(await getPages()).toEqual([
      {
        ...page,
        id: page2.id,
        ref: "test2",
        path: "test2",
      },
    ]);
    expect(await getPageLinks({ from: page1.id })).toEqual({ content: [] });
  });
});

const conn = {
  name: "foo",
  collectionNames: ["foo", "bar"],
  mediaStore: {
    write: mock(async () => {}),
    read: mock(async () => Buffer.from("")),
    exists: mock(async () => false),
  } satisfies MediaStore,
  mediaOptimizer: {
    optimizeImage: mock(async () => {}),
  },
  pullCollectionRefs: mock(async function* (collection: "foo" | "bar") {
    if (collection === "foo") yield ["test"];
  }),
  pull: mock(async function* (collection: "foo" | "bar") {
    if (collection === "foo")
      yield {
        page,
        assets: [] as { block: ImageBlock; ref: string }[],
      };
  }),
  fetchAsset: mock(async () => new ReadableStream()),
} satisfies Omit<Connection<"foo" | "bar">, "id">;

const page: Omit<PageData<Page<{ collection: "foo" | "bar" }>>, "id"> = {
  ref: "test",
  path: "test",
  collection: "foo",
  title: "abc",
  description: "test",
  content: [],
  props: {},
  connection: 1,
  publishedAt: 0,
  createdAt: 0,
  changedAt: 0,
  links: { content: [] as string[] },
};
