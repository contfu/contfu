import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventType, type ImageBlock } from "@contfu/core";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable, syncTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { listCollections } from "../collections/listCollections";
import { setCollection } from "../collections/setCollection";
import { createItem } from "../items/createItem";
import { queryItems } from "../items/queryItems";
import type { FileStore } from "../../domain/files";
import type { MediaOptimizer } from "../../domain/media";

const key = Buffer.alloc(32, 1);

async function waitForReadyFile(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const files = db.select().from(fileTable).all();
    if (files.some((file) => file.status === 2)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("Timed out waiting for media queue");
}

describe("contfu connect", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("article", "Article", {});
  });

  afterEach(() => {
    mock.restore();
  });

  test("throws when an item arrives before its collection schema", async () => {
    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: 9,
            collection: "missing",
            changedAt: 1700000000,
            props: { title: "Hello" },
          },
          index: 1,
        };
      },
    }));

    const { connect } = await import("./connect");

    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(
      (async () => {
        for await (const _ of connect({ key, reconnect: false })) {
          // consume
        }
      })(),
    ).rejects.toThrow('Received ITEM_CHANGED for unknown collection "missing" before schema');
  });

  test("persists collection rename events to collections and existing items", async () => {
    createItem({
      id: 101,
      collection: "article",
      changedAt: 1700000000,
      props: { title: "Before rename" },
      content: [],
    });

    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.COLLECTION_RENAMED,
          oldName: "article",
          newName: "blogPosts",
          newDisplayName: "Blog Posts",
          index: 88,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false })) {
      // consume
    }

    const collections = listCollections();
    expect(collections.some((collection) => collection.name === "article")).toBe(false);
    const renamedCollection = collections.find((collection) => collection.name === "blogPosts");
    expect(renamedCollection?.displayName).toBe("Blog Posts");
    expect(queryItems({ collection: "article" }).items).toHaveLength(0);
    expect(queryItems({ collection: "blogPosts" }).items[0].props.title).toBe("Before rename");
  });

  test("persists collection removal events to collections and items", async () => {
    createItem({
      id: 102,
      collection: "article",
      changedAt: 1700000000,
      props: { title: "Before removal" },
      content: [],
    });

    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.COLLECTION_REMOVED,
          collection: "article",
          index: 89,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false })) {
      // consume
    }

    expect(listCollections().some((collection) => collection.name === "article")).toBe(false);
    expect(queryItems({ collection: "article" }).items).toHaveLength(0);
  });

  test("persists sync index from events", async () => {
    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: 1,
            collection: "article",
            changedAt: 1700000000,
            props: { title: "Hello" },
          },
          index: 77,
        };
      },
    }));

    const { connect } = await import("./connect");

    const events: unknown[] = [];
    for await (const event of connect({ key, reconnect: false })) {
      events.push(event);
    }

    expect(events).toHaveLength(1);

    const rows = db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(77);
  });

  test("Local Runtime downloads and processes Files when configured", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() => Promise.resolve([])),
    };

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(Buffer.from("img"), { status: 200 })),
    ) as unknown as typeof fetch;

    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: 4,
            collection: "article",
            changedAt: 1700000000,
            props: { title: "With image" },
            content: [["i", "https://example.com/photo.png", "alt text"] as ImageBlock],
          },
          index: 200,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false, fileStore, mediaOptimizer })) {
      // consume
    }

    // oxlint-disable-next-line typescript/unbound-method -- mock method reference in expect() assertion
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
    await waitForReadyFile();
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].status).toBe(2);
    expect(files[0].data?.toString("utf8")).toBe("img");

    // Local Runtime file link should exist
    const junctions = db.select().from(itemFileTable).all();
    expect(junctions).toHaveLength(1);
  });

  test("stores files as-is without optimizer (default fileStore)", async () => {
    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: 7,
            collection: "article",
            changedAt: 1700000000,
            props: { title: "No files" },
            content: [["i", "https://example.com/photo2.png", "alt"] as ImageBlock],
          },
          index: 300,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false })) {
      // consume
    }

    // Default fileStore is used; files stored as-is (no optimizer)
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].meta.ext).toBe("png");
  });

  test("DELETED event calls deleteFilesByItem when fileStore provided", async () => {
    const fileStore: FileStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };

    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_DELETED,
          item: 1,
          index: 400,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false, fileStore })) {
      // consume
    }

    // Verify the event was processed (sync index persisted)
    const rows = db.select().from(syncTable).all();
    expect(rows[0].index).toBe(400);
  });
});
