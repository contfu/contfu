import { EventType, type Item } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { mockClient } from "../../../test/mocks/notion";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import { NotionPullOpts, NotionSource } from "./notion-source";

type Page1 = Item<{
  Color: string;
}>;
const pullOpts: NotionPullOpts = {
  accountId: 1,
  sourceId: 1,
  collectionId: 1,
  ref: Buffer.alloc(0),
  type: "notion",
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
            id: "HJQ1JGsVQx2aOw-R-c400g",
            collection: 1,
            src: 1,
            changedAt: 1716353760000,
            createdAt: 1711864560000,
            props: {
              Color: "red",
              Description: "A",
              "Other Reference": ["aEyH_tGiTCGj3oxV2s45zQ"],
              "Self Reference": ["xdXoCyiWRuCijuE_1I0eXQ"],
              Title: "Foo",
            },
          },
          src: 1,
        },
        {
          type: EventType.CHANGED,
          collection: 1,
          item: {
            id: "xdXoCyiWRuCijuE_1I0eXQ",
            collection: 1,
            src: 1,
            changedAt: 1716353820000,
            createdAt: 1711864560000,
            props: {
              Color: "blue",
              Description: "B",
              "Other Reference": [],
              "Self Reference": ["HJQ1JGsVQx2aOw-R-c400g"],
              Slug: "/bar",
              Title: "Bar",
            },
          },
          src: 1,
        },
      ]);
    });
  });
});
