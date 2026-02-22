import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { EventType, SourceType } from "@contfu/core";
import { db } from "../../infra/db/db";
import { syncTable } from "../../infra/db/schema";
import { truncateAllTables } from "../../../test/setup.ts";

const key = Buffer.alloc(32, 1);

describe("contfu connect", () => {
  beforeEach(async () => {
    await truncateAllTables();
  });

  afterEach(() => {
    mock.restore();
  });

  test("persists sync index from events", async () => {
    await mock.module("@contfu/client", () => ({
      connectToStream: async function* () {
        yield {
          type: EventType.CHANGED,
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
          type: EventType.DELETED,
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
});
