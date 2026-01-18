import type { ImageBlock } from "@contfu/core";
import { beforeEach, describe, expect, it, mock } from "bun:test";
import "../../test/setup";
import type { Connection } from "../connections/connections";
import { createConnection } from "../connections/data/connection-datasource";
import { hashId } from "../core/crypto";
import type { MediaStore } from "../media/media";
import {
  createPage,
  createPageLink,
  getPage,
  getPageLinks,
  getPages,
} from "../pages/data/page-datasource";
import type { Page, PageData } from "../pages/pages";
import { sync } from "./sync";

let c: Connection<"foo" | "bar">;
let connectionId: string;

beforeEach(async () => {
  c = await createConnection(conn);
  connectionId = c.id;
});

function makePageId(ref: string): string {
  return hashId(`${connectionId}|${ref}`);
}

function makeFullPage(partial: Omit<PageData, "id" | "connection">): Omit<PageData, "links"> {
  const { links: _links, ...rest } = partial as PageData;
  return {
    ...rest,
    id: makePageId(partial.ref),
    connection: connectionId,
  };
}

describe("sync()", () => {
  it("should initially pull from a connection", async () => {
    await sync([c]);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should continuously pull from a connection", async () => {
    conn.pull.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") {
        yield { page: basePage, assets: [] };
        yield { page: { ...basePage, ref: "test2", path: "test2" }, assets: [] };
      }
    });

    await sync([c]);

    expect(conn.pull).toHaveBeenCalled();
  });

  it("should create pages in the database", async () => {
    await sync([c]);

    expect(conn.pull).toHaveBeenCalled();
    const id = makePageId("test");
    const result = await getPage({ id });
    expect(result).toMatchObject({
      id,
      ref: "test",
      path: "test",
      collection: "foo",
      connection: connectionId,
    });
  });

  it("should create new links in the database", async () => {
    conn.pull.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") {
        yield {
          page: { ...basePage, links: { content: [makePageId("test2")] } },
          assets: [],
        };
        yield {
          page: { ...basePage, collection: "bar", ref: "test2", path: "test2" },
          assets: [],
        };
      }
    });

    await sync([c]);

    const id1 = makePageId("test");
    const id2 = makePageId("test2");
    expect(await getPageLinks({ from: id1 })).toEqual({
      content: [id2],
    });
  });

  it("should update links in the database", async () => {
    const id1 = makePageId("test");
    const id2 = makePageId("test2");
    const page1 = await createPage(makeFullPage(basePage));
    const page2 = await createPage(makeFullPage({ ...basePage, ref: "test2", path: "test2" }));
    await createPageLink({ type: "content", from: page1.id, to: page2.id });
    conn.pull.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") {
        yield {
          page: { ...basePage, links: { content: [], foo: [id2] } },
          assets: [],
        };
      }
    });
    conn.pullCollectionRefs.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") yield [id1, id2];
    });

    await sync([c]);

    expect(await getPageLinks({ from: page1.id })).toEqual({
      content: [],
      foo: [page2.id],
    });
  });

  it("should store assets", async () => {
    const block = ["i", "/test.jpg", "test"] satisfies ImageBlock;
    conn.pull.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") {
        yield {
          page: { ...basePage, content: block },
          assets: [{ block, ref: "/test-ref.jpg" }],
        };
      }
    });
    const hash = hashId(`${c.id}|/test-ref.jpg`);

    await sync([c]);

    expect(conn.mediaStore.exists).toHaveBeenCalledWith(hash);
    expect(conn.fetchAsset).toHaveBeenCalledWith("/test.jpg");
    expect(conn.mediaOptimizer.optimizeImage).toHaveBeenCalledWith(
      conn.mediaStore,
      `${hash}.jpg`,
      conn.fetchAsset.mock.results[0].value,
    );
    expect(block).toEqual(["i", `${hash}.jpg`, "test"]);
  });

  it("should remove orphans with links", async () => {
    const id2 = makePageId("test2");
    const page1 = await createPage(makeFullPage(basePage));
    const page2 = await createPage(makeFullPage({ ...basePage, ref: "test2", path: "test2" }));
    await createPageLink({ type: "foo", from: page1.id, to: page2.id });
    conn.pull.mockImplementationOnce(async function* () {});
    conn.pullCollectionRefs.mockImplementationOnce(async function* (collection: "foo" | "bar") {
      if (collection === "foo") yield [id2];
    });

    await sync([c]);

    const pages = await getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({
      id: page2.id,
      ref: "test2",
      path: "test2",
    });
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
    if (collection === "foo") yield [hashId(`foo|test`)];
  }),
  pull: mock(async function* (collection: "foo" | "bar") {
    if (collection === "foo")
      yield {
        page: basePage,
        assets: [] as { block: ImageBlock; ref: string }[],
      };
  }),
  fetchAsset: mock(async () => new ReadableStream()),
} satisfies Omit<Connection<"foo" | "bar">, "id">;

const basePage: Omit<PageData<Page<{ collection: "foo" | "bar" }>>, "id" | "connection"> = {
  ref: "test",
  path: "test",
  collection: "foo",
  title: "abc",
  description: "test",
  content: [],
  props: {},
  publishedAt: 0,
  createdAt: 0,
  changedAt: 0,
  links: { content: [] as string[] },
};
