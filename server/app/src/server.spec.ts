import { connectTo } from "@contfu/client";
import { Block, EventType } from "@contfu/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import Elysia from "elysia";
import { mockClient } from "../test/mocks/notion";
import { app } from "./server";
import {
  callout,
  childList,
  dbQueryPage1,
  emptyList,
  page1,
  tableContent,
} from "./sources/notion/__fixtures__/notion-query-results";

describe("connect via WS", () => {
  let instance: Elysia;
  beforeAll(() => {
    instance = app.listen(9999);
  });

  afterAll(async () => {
    await instance.stop();
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
    }>([
      {
        id: "1234567890abcdef1234567890abcdef",
        type: "notion",
        notionKey:
          "5B1060C74333C08D5721554550AAE735D7B8928274C0218877B01BBC53D53B9C",
        key: "5B1060C74333C08D5721554550AAE735D7B8928274C0218877B01BBC53D53B9C",
        collections: {
          pages: {
            dbId: "5b1060c7-4333-c08d-5721-554550aae735",
            content: "Content",
          },
        },
      },
    ]);
    const item1 = conn.next();
    const item2 = conn.next();
    const item3 = conn.next();

    expect((await item1).value).toEqual({
      type: EventType.LIST_IDS,
      id: "EjRWeJCrze8SNFZ4kKvN7w",
      collection: "pages",
      itemIds: ["HJQ1JGsVQx2aOw-R-c400g", "xdXoCyiWRuCijuE_1I0eXQ"],
    });
    expect((await item2).value).toEqual({
      type: EventType.CHANGED,
      id: "EjRWeJCrze8SNFZ4kKvN7w",
      item: {
        changedAt: 1716353760000,
        collection: "pages",
        createdAt: 1711864560000,
        id: "HJQ1JGsVQx2aOw-R-c400g",
        src: "EjRWeJCrze8SNFZ4kKvN7w",
        props: {
          Color: "red",
          Description: "A",
          "Other Reference": ["684c87fed1a24c21a3de8c55dace39cd"],
          "Self Reference": ["c5d5e80b289646e0a28ee13fd48d1e5d"],
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
    expect((await item3).value).toEqual({
      type: EventType.CHANGED,
      id: "EjRWeJCrze8SNFZ4kKvN7w",
      item: {
        id: "xdXoCyiWRuCijuE_1I0eXQ",
        src: "EjRWeJCrze8SNFZ4kKvN7w",
        collection: "pages",
        createdAt: 1711864560000,
        changedAt: 1716353820000,
        props: {
          Description: "B",
          Slug: "/bar",
          "Self Reference": ["1c9435246b15431d9a3b0f91f9ce34d2"],
          "Other Reference": [],
          Color: "blue",
          Title: "Bar",
          Content: [],
        },
      },
    });
  });
});
`
- Test
- nsdrtaei
> Test **tsrf
> Blubb**

> foo neih
`;
