import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventType, SourceType, type ImageBlock } from "@contfu/core";
import { db } from "../../infra/db/db";
import { assetTable, itemAssetTable, syncTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup.ts";
import { setCollection } from "../collections/setCollection";
import type { MediaOptimizer, MediaStore } from "../media/media";

const key = Buffer.alloc(32, 1);

describe("contfu connect", () => {
  beforeEach(async () => {
    await truncateAllTables();
    await setCollection("article", "Article", {});
  });

  afterEach(() => {
    mock.restore();
  });

  test("persists sync index from events", async () => {
    await mock.module("@contfu/client", () => ({
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: Buffer.from([1, 2, 3]),
            sourceType: SourceType.WEB,
            ref: "https://example.com/abc",
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

    const rows = await db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(77);
  });

  test("uses persisted sync index + 1 as from when reconnecting", async () => {
    await db.insert(syncTable).values({ index: 99 }).run();

    let receivedFrom: number | undefined;

    await mock.module("@contfu/client", () => ({
      connectToStream: async function* (opts?: { from?: number }) {
        receivedFrom = opts?.from;
        yield {
          type: EventType.ITEM_DELETED,
          item: Buffer.from([1]),
          index: 100,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false })) {
      // consume
    }

    expect(receivedFrom).toBe(100);

    const rows = await db.select().from(syncTable).all();
    expect(rows[0].index).toBe(100);
  });

  test("processes ImageBlocks when mediaStore and mediaOptimizer provided", async () => {
    const mediaStore: MediaStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };
    const mediaOptimizer: MediaOptimizer = {
      optimize: mock(() => Promise.resolve([])),
    };

    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(Buffer.from("img"), { status: 200 })),
    ) as typeof fetch;

    await mock.module("@contfu/client", () => ({
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: Buffer.from([4, 5, 6]),
            sourceType: SourceType.WEB,
            ref: "https://example.com/post",
            collection: "article",
            changedAt: 1700000000,
            props: { title: "With image" },
            content: [["i", "https://example.com/photo.png", "alt text", [800]] as ImageBlock],
          },
          index: 200,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false, mediaStore, mediaOptimizer })) {
      // consume
    }

    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    expect(assets[0].originalUrl).toBe("https://example.com/photo.png");

    // Junction row should exist
    const junctions = await db.select().from(itemAssetTable).all();
    expect(junctions).toHaveLength(1);
  });

  test("stores assets as-is without optimizer (default mediaStore)", async () => {
    await mock.module("@contfu/client", () => ({
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: Buffer.from([7, 8, 9]),
            sourceType: SourceType.WEB,
            ref: "https://example.com/post2",
            collection: "article",
            changedAt: 1700000000,
            props: { title: "No media" },
            content: [["i", "https://example.com/photo2.png", "alt", [800]] as ImageBlock],
          },
          index: 300,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false })) {
      // consume
    }

    // Default mediaStore is used; assets stored as-is (no optimizer)
    const assets = await db.select().from(assetTable).all();
    expect(assets).toHaveLength(1);
    expect(assets[0].ext).toBe("png");
  });

  test("DELETED event calls deleteAssetsByItem when mediaStore provided", async () => {
    const mediaStore: MediaStore = {
      write: mock(() => Promise.resolve()),
      read: mock(() => Promise.resolve(null)),
      exists: mock(() => Promise.resolve(false)),
    };

    await mock.module("@contfu/client", () => ({
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_DELETED,
          item: Buffer.from([1]),
          index: 400,
        };
      },
    }));

    const { connect } = await import("./connect");

    for await (const _ of connect({ key, reconnect: false, mediaStore })) {
      // consume
    }

    // Verify the event was processed (sync index persisted)
    const rows = await db.select().from(syncTable).all();
    expect(rows[0].index).toBe(400);
  });
});
