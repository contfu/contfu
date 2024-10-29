import { connectTo } from "@contfu/client";
import { Block, EventType } from "@contfu/core";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import Elysia from "elysia";
import { Subscription } from "rxjs";
import { mockClient } from "../test/mocks/notion";
import { fakeTimers } from "../test/timers";
import { createAccount, createConsumer } from "./access/access-repository";
import { DbAccount, DbConsumer } from "./access/db/access-schema";
import { SourceType } from "./data/data";
import {
  connectConsumerToCollection,
  createCollection,
  createSource,
} from "./data/data-repository";
import { getItemIds } from "./data/db/data-datasource";
import { DbCollection } from "./data/db/data-schema";
import { app, processEvents$ } from "./server";
import {
  callout,
  childList,
  dbQueryData1,
  dbQueryPage1,
  emptyList,
  page1,
  tableContent,
} from "./sync/notion/__fixtures__/notion-query-results";
import { MIN_SYNC_INTERVAL } from "./sync/sync-constants";
import { sync$ } from "./sync/sync-service";

const clock = fakeTimers();

describe("connect via WS", () => {
  let server: Elysia;
  let acc: DbAccount;
  let cons: DbConsumer;
  let sub: Subscription;
  let coll: DbCollection;

  beforeAll(async () => {
    server = app.listen(9999);
  });

  beforeEach(async () => {
    sub = processEvents$.subscribe();
    sub.add(sync$.subscribe());
    acc = await createAccount("test@test.com");
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
    mockClient.databases.query.mockResolvedValue(dbQueryPage1);
    mockClient.blocks.children.list.mockImplementation(async () => emptyList);
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
    const id1Str = "mdGrrv5dvahdwf5F";
    const id2Str = "fMSi1vKEuSZ-r3_7";
    const id1 = Buffer.from(id1Str, "base64url");
    const id2 = Buffer.from(id2Str, "base64url");

    const item1 = conn.next();
    const item2 = conn.next();
    await clock.tickAsync(MIN_SYNC_INTERVAL);

    expect((await item1).value).toEqual({
      type: EventType.CHANGED,
      collection: 1,
      item: {
        id: id1,
        collection: 1,
        changedAt: 1716353760000,
        createdAt: 1711864560000,
        props: {
          Color: "red",
          Description: "A",
          "Other Reference": ["Uqf_AYLTfb4pdBDh"],
          "Self Reference": [id2Str],
          Title: "Foo",
        },
      },
    });
    expect((await item2).value).toEqual({
      type: EventType.CHANGED,
      collection: 1,
      item: {
        id: id2,
        collection: 1,
        createdAt: 1711864560000,
        changedAt: 1716353820000,
        props: {
          Description: "B",
          Slug: "/bar",
          "Self Reference": [id1Str],
          "Other Reference": [],
          Color: "blue",
          Title: "Bar",
        },
      },
    });
    expect(await getItemIds(acc.id, coll.id)).toEqual(
      Buffer.concat([id1, id2])
    );
  });

  it("should provide completely filled items", async () => {
    mockClient.databases.query.mockResolvedValue({
      ...dbQueryPage1,
      results: [dbQueryData1],
    });
    mockClient.blocks.children.list.mockImplementation(async ({ block_id }) =>
      block_id === "1c943524-6b15-431d-9a3b-0f91f9ce34d2"
        ? page1
        : block_id === "8f19d366-a373-4461-8129-090ba83e204a"
        ? tableContent
        : block_id === "15e26736-4959-4e51-86fe-1f3bcafc6321"
        ? childList
        : block_id === "95592c8d-35ff-4915-ab0f-73444448706a"
        ? callout
        : emptyList
    );
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
    const id1Str = "mdGrrv5dvahdwf5F";
    const id2Str = "fMSi1vKEuSZ-r3_7";
    const id1 = Buffer.from(id1Str, "base64url");

    const item1 = conn.next();
    await clock.tickAsync(MIN_SYNC_INTERVAL);

    expect((await item1).value).toEqual({
      type: EventType.CHANGED,
      collection: 1,
      item: {
        id: id1,
        collection: 1,
        changedAt: 1716353760000,
        createdAt: 1711864560000,
        props: {
          Color: "red",
          Description: "A",
          "Other Reference": ["Uqf_AYLTfb4pdBDh"],
          "Self Reference": [id2Str],
          Title: "Foo",
        },
        content: [
          [
            "t",
            true,
            [
              [["a"], ["b"]],
              [["x", ["c", "foo"]], ["y"]],
              [[], []],
            ],
          ],
          [
            "u",
            ["Test"],
            [
              ["u", ["tmsreia"], ["tsrenia"]],
              ["o", ["bar"]],
            ],
            ["nsdrtaei"],
          ],
          ["q", ["Test", ["b", "tsrf\nBlubb"]]],
          ["q", ["foo\nneih"]],
        ],
      },
    });
  });
});
