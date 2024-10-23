import { connectTo } from "@contfu/client";
import { Block, EventType } from "@contfu/core";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "bun:test";
import Elysia from "elysia";
import { mockClient } from "../test/mocks/notion";
import { createAccount, createConsumer } from "./access/access-repository";
import { DbAccount, DbConsumer } from "./access/db/access-schema";
import {
  connectConsumerToCollection,
  createCollection,
  createSource,
} from "./data/data-repository";
import { app } from "./server";
import {
  callout,
  childList,
  dbQueryPage1,
  emptyList,
  page1,
  tableContent,
} from "./sync/notion/__fixtures__/notion-query-results";

const key = "testkey";

describe("connect via WS", () => {
  let server: Elysia;
  let acc: DbAccount;
  let cl: DbConsumer;

  beforeAll(async () => {
    server = app.listen(9999);
  });

  beforeEach(async () => {
    acc = await createAccount("test@test.com");
    cl = await createConsumer(acc.id, "test");
    const src = await createSource(acc.id, {
      name: "notion-test",
      credentials: Buffer.from("abc", "base64url"),
      type: "notion",
    });
    const coll = await createCollection(
      acc.id,
      src.id,
      "test",
      Buffer.alloc(0)
    );
    await connectConsumerToCollection(acc.id, cl.id, coll.id);
  });

  afterAll(async () => {
    await server.stop();
  });

  it("should receive items", async () => {
    mockClient.databases.query.mockResolvedValue(dbQueryPage1);
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
    const conn = connectTo<{
      pages: {
        Color: string;
        Description?: string;
        "Other Reference": string[];
        "Self Reference": string[];
        Title: string;
        Content: Block[];
        Slug?: string;
      };
    }>(cl.key!);
    const item1 = conn.next();
    const item2 = conn.next();

    // expect((await item1).value).toEqual({
    //   type: EventType.LIST_IDS,
    //   src: 1,
    //   collection: 1,
    //   ids: ["HJQ1JGsVQx2aOw-R-c400g", "xdXoCyiWRuCijuE_1I0eXQ"],
    // });
    expect((await item1).value).toEqual({
      type: EventType.CHANGED,
      src: 1,
      collection: 1,
      item: {
        id: "HJQ1JGsVQx2aOw-R-c400g",
        src: 1,
        collection: 1,
        changedAt: 1716353760000,
        createdAt: 1711864560000,
        props: {
          Color: "red",
          Description: "A",
          "Other Reference": ["aEyH_tGiTCGj3oxV2s45zQ"],
          "Self Reference": ["xdXoCyiWRuCijuE_1I0eXQ"],
          Title: "Foo",
          Content: [
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
      },
    });
    expect((await item2).value).toEqual({
      type: EventType.CHANGED,
      src: 1,
      collection: 1,
      item: {
        id: "xdXoCyiWRuCijuE_1I0eXQ",
        src: 1,
        collection: 1,
        createdAt: 1711864560000,
        changedAt: 1716353820000,
        props: {
          Description: "B",
          Slug: "/bar",
          "Self Reference": ["HJQ1JGsVQx2aOw-R-c400g"],
          "Other Reference": [],
          Color: "blue",
          Title: "Bar",
          Content: [],
        },
      },
    });
  });
});
