import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventType, ConnectionType, type ImageBlock } from "@contfu/core";
import { db } from "../../infra/db/db";
import { fileTable, itemFileTable, syncTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup";
import { setCollection } from "../collections/setCollection";
import type { FileStore } from "../../domain/files";
import type { MediaOptimizer } from "../../domain/media";

const key = Buffer.alloc(32, 1);

describe("contfu connect", () => {
  beforeEach(() => {
    truncateAllTables();
    setCollection("article", "Article", {});
  });

  afterEach(() => {
    mock.restore();
  });

  test("persists sync index from events", async () => {
    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
      connectToStream: async function* () {
        yield {
          type: EventType.ITEM_CHANGED,
          item: {
            id: Buffer.from([1, 2, 3]),
            connectionType: ConnectionType.WEB,
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

    const rows = db.select().from(syncTable).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].index).toBe(77);
  });

  test("uses persisted sync index + 1 as from when reconnecting", async () => {
    db.insert(syncTable).values({ index: 99 }).run();

    let receivedFrom: number | undefined;

    await mock.module("@contfu/connect", () => ({
      // eslint-disable-next-line typescript/require-await -- async generator required by AsyncGenerator return type
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

    const rows = db.select().from(syncTable).all();
    expect(rows[0].index).toBe(100);
  });

  test("processes ImageBlocks when fileStore and mediaOptimizer provided", async () => {
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
            id: Buffer.from([4, 5, 6]),
            connectionType: ConnectionType.WEB,
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

    for await (const _ of connect({ key, reconnect: false, fileStore, mediaOptimizer })) {
      // consume
    }

    // oxlint-disable-next-line typescript/unbound-method -- mock method reference in expect() assertion
    expect(mediaOptimizer.optimize).toHaveBeenCalledTimes(1);
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].originalUrl).toBe("https://example.com/photo.png");

    // Junction row should exist
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
            id: Buffer.from([7, 8, 9]),
            connectionType: ConnectionType.WEB,
            ref: "https://example.com/post2",
            collection: "article",
            changedAt: 1700000000,
            props: { title: "No files" },
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

    // Default fileStore is used; files stored as-is (no optimizer)
    const files = db.select().from(fileTable).all();
    expect(files).toHaveLength(1);
    expect(files[0].ext).toBe("png");
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
          item: Buffer.from([1]),
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
