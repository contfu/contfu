import { connectTo } from "@contfu/client";
import { Block } from "@contfu/core";
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import Elysia from "elysia";
import { mockClient } from "../test/mocks/notion";
import { app } from "./server";
import {
  dbQueryPage1,
  pagesQuery1,
} from "./sources/notion/__fixtures__/notion-query-results";

describe("connect via WS", () => {
  let instance: Elysia;
  beforeAll(() => {
    instance = app.listen(3000);
  });

  afterAll(async () => {
    await instance.stop();
  });

  it("should receive items", async () => {
    mockClient.databases.query.mockResolvedValue(dbQueryPage1);
    mockClient.blocks.children.list
      .mockResolvedValueOnce(pagesQuery1)
      .mockResolvedValue({
        object: "list",
        results: [],
        next_cursor: null,
        has_more: false,
        type: "block",
        block: {},
        request_id: "9053bda1-915f-48aa-a461-b4fc552bc78a",
      });
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
        id: "123",
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
      id: "123",
      refs: [
        "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
        "c5d5e80b-2896-46e0-a28e-e13fd48d1e5d",
      ],
    });
    expect((await item2).value).toEqual({
      id: "123",
      item: {
        changedAt: 1716353760000,
        collection: "pages",
        createdAt: 1711864560000,
        id: "1c9435246b15431d9a3b0f91f9ce34d2",
        src: "123",
        props: {
          Color: "red",
          Description: "A",
          "Other Reference": ["684c87fed1a24c21a3de8c55dace39cd"],
          "Self Reference": ["c5d5e80b289646e0a28ee13fd48d1e5d"],
          Title: "Foo",
          Content: [
            ["t", true, []],
            ["u", ["Test"], [], ["nsdrtaei"]],
            ["q", ["Test", ["b", "tsrf\nBlubb"]]],
            ["q", ["foo\nneih"]],
          ],
        },
      },
    });
    expect((await item3).value).toEqual({
      id: "123",
      item: {
        id: "c5d5e80b289646e0a28ee13fd48d1e5d",
        src: "123",
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
