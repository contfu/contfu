import { connectTo } from "@contfu/client";
import { Block, EventType, Item } from "@contfu/core";
import { Collection, Consumer, User } from "./src/db/db";
import { NotionSource } from "@contfu/notion";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  mock,
} from "bun:test";
import Elysia from "elysia";
import { Subscription } from "rxjs";
import { fakeTimers } from "../test/timers";
import { createConsumer, createUser } from "./access/access-repository";
import { SourceType } from "./data/data";
import {
  connectConsumerToCollection,
  createCollection,
  createSource,
} from "./data/data-repository";
import { getItemIds } from "./data/db/data-datasource";
import { MIN_FETCH_INTERVAL } from "./sync/sync-constants";

const mockNotionSource = {
  fetch: mock(() => {
    return (async function* (): AsyncGenerator<Item> {})();
  }),
  getCollectionSchema: mock(() => Promise.resolve({})),
} satisfies NotionSource;

mock.module("@contfu/notion", () => ({
  NotionSource: mock(() => mockNotionSource),
}));
const { app, processItems$ } = await import("./server");
const { sync$ } = await import("./sync/sync-service");

const clock = fakeTimers();

describe("connect via WS", () => {
  let server: Elysia;
  let acc: User;
  let cons: Consumer;
  let sub: Subscription;
  let coll: Collection;

  beforeAll(async () => {
    server = app.listen(9999);
  });

  beforeEach(async () => {
    sub = processItems$.subscribe();
    sub.add(sync$.subscribe());
    acc = await createUser("test@test.com", "test");
    cons = await createConsumer(acc.id, "test");
    const src = await createSource(acc.id, {
      name: "notion-test",
      credentials: Buffer.from("abc", "base64url"),
      type: SourceType.NOTION,
    });
    coll = await createCollection(acc.id, src.id, "test", Buffer.alloc(0));
    await connectConsumerToCollection(acc.id, cons.id, coll.id);
  });

  afterEach(async () => {
    sub.unsubscribe();
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should receive items", async () => {
    const id1Str = "mdGrrv5dvah";
    const id2Str = "fMSi1vKEuSZ";
    const id1 = Buffer.from(id1Str, "base64url");
    const id2 = Buffer.from(id2Str, "base64url");
    mockNotionSource.fetch.mockImplementationOnce(() => {
      return (async function* () {
        yield {
          id: id1,
          ref: id1,
          collection: 1,
          changedAt: 1716353760000,
          createdAt: 1711864560000,
          props: {},
        } satisfies Item;
        yield {
          id: id2,
          ref: id2,
          collection: 1,
          createdAt: 1711864560000,
          changedAt: 1716353820000,
          props: {},
        } satisfies Item;
      })();
    });
    const conn = await connectTo<{
      pages: {
        color: string;
        description?: string;
        otherReference: string[];
        selfReference: string[];
        title: string;
        content: Block[];
        slug?: string;
      };
    }>(cons.key!);

    const item1 = conn.next();
    const item2 = conn.next();
    await clock.tickAsync(MIN_FETCH_INTERVAL);

    expect((await item1).value).toEqual({
      type: EventType.CHANGED,
      item: {
        id: id1,
        ref: id1,
        collection: 1,
        changedAt: 1716353760000,
        createdAt: 1711864560000,
        props: {},
      },
    });
    expect((await item2).value).toEqual({
      type: EventType.CHANGED,
      item: {
        id: id2,
        ref: id2,
        collection: 1,
        createdAt: 1711864560000,
        changedAt: 1716353820000,
        props: {},
      },
    });
    expect([...(await getItemIds(acc.id, coll.id))]).toEqual([id1, id2].sort());
  });
});
