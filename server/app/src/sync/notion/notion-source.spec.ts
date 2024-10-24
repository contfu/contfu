import { EventType } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { mockClient } from "../../../test/mocks/notion";
import { SourceType } from "../../data/data";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import type { NotionPullOpts } from "./notion";
import { NotionSource } from "./notion-source";
const pullOpts: NotionPullOpts = {
  accountId: 1,
  sourceId: 1,
  collectionId: 1,
  ref: Buffer.alloc(0),
  type: SourceType.NOTION,
  credentials: Buffer.alloc(0),
};
const source = new NotionSource();

describe("NotionConnection", () => {
  describe("pullConnectionRefs()", () => {
    // it("should get all refs from all collections from notion", async () => {
    //   mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
    //   const count = await source.pull(pullOpts);
    //   const value = await firstValueFrom(source.pull(pullOpts));
    //   expect(value).toEqual([
    //     "HJQ1JGsVQx2aOw-R-c400g",
    //     "xdXoCyiWRuCijuE_1I0eXQ",
    //   ]);
    // });
  });

  describe("pull()", () => {
    it("should get all pages from a collection from notion", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({
        results: [],
      });

      const events = Array.fromAsync(source.fetch(pullOpts));

      expect(await events).toEqual([
        {
          type: EventType.CHANGED,
          collection: 1,
          item: {
            id: 1,
            collection: 1,
            src: 1,
            changedAt: 1716353760000,
            createdAt: 1711864560000,
            props: {
              Color: "red",
              Description: "A",
              "Other Reference": [3],
              "Self Reference": [2],
              Title: "Foo",
            },
          },
          account: 1,
        },
        {
          type: EventType.CHANGED,
          collection: 1,
          item: {
            id: 2,
            collection: 1,
            src: 1,
            changedAt: 1716353820000,
            createdAt: 1711864560000,
            props: {
              Color: "blue",
              Description: "B",
              "Other Reference": [],
              "Self Reference": [1],
              Slug: "/bar",
              Title: "Bar",
            },
          },
          account: 1,
        },
      ]);
    });
  });
});
