import type { Item } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { firstValueFrom, take, toArray } from "rxjs";
import { mockClient } from "../../../test/mocks/notion";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import { NotionSource } from "./notion-source";

type Page1 = Item<{
  Color: string;
}>;
const collection = {
  id: 1,
  dbId: process.env.NOTION_DB_ID_1!,
};
const source = new NotionSource({
  id: 1,
  type: "notion",
  key: process.env.CONN_KEY!,
  notionKey: process.env.API_TOKEN!,
  collections: [collection],
});

describe("NotionConnection", () => {
  describe("pullConnectionRefs()", () => {
    it("should get all refs from all collections from notion", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      const value = await firstValueFrom(
        source.pullCollectionIds(source.collections[0])
      );

      expect(value).toEqual([
        "HJQ1JGsVQx2aOw-R-c400g",
        "xdXoCyiWRuCijuE_1I0eXQ",
      ]);
    });
  });

  describe("pull()", () => {
    it("should get all pages from a collection from notion", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      mockClient.blocks.children.list.mockResolvedValue({
        results: [],
      });
      const value = await firstValueFrom(
        source.pull(collection).pipe(take(2), toArray())
      );

      expect(value).toEqual([
        {
          collection: 1,
          id: "HJQ1JGsVQx2aOw-R-c400g",
          changedAt: 1716353760000,
          createdAt: 1711864560000,
          props: {
            Color: "red",
            Description: "A",
            "Other Reference": ["aEyH_tGiTCGj3oxV2s45zQ"],
            "Self Reference": ["xdXoCyiWRuCijuE_1I0eXQ"],
            Title: "Foo",
          },
          src: 1,
        },
        {
          collection: 1,
          id: "xdXoCyiWRuCijuE_1I0eXQ",
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
          src: 1,
        },
      ]);
    });
  });
});
