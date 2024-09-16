import type { Item } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { firstValueFrom, take, toArray } from "rxjs";
import { mockClient } from "../../../test/mocks/notion";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import { NotionSource } from "./notion-source";

type Page1 = Item<
  "pages",
  {
    Color: string;
  }
>;
const source = new NotionSource<"pages">({
  id: "11111111111111111111111111111111",
  type: "notion",
  key: process.env.CONN_KEY!,
  notionKey: process.env.API_TOKEN!,
  collections: {
    pages: {
      dbId: process.env.NOTION_DB_ID_1!,
    },
  },
});

describe("NotionConnection", () => {
  describe("pullConnectionRefs()", () => {
    it("should get all refs from all collections from notion", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      const value = await firstValueFrom(source.pullCollectionRefs("pages"));

      expect(value).toEqual([
        "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
        "c5d5e80b-2896-46e0-a28e-e13fd48d1e5d",
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
        source.pull("pages").pipe(take(2), toArray())
      );

      expect(value).toEqual([
        {
          id: "1c9435246b15431d9a3b0f91f9ce34d2",
          src: "11111111111111111111111111111111",
          collection: "pages",
          changedAt: 1716353760000,
          createdAt: 1711864560000,
          props: {
            Title: "Foo",
            Description: "A",
            Color: "red",
            "Self Reference": ["c5d5e80b289646e0a28ee13fd48d1e5d"],
            "Other Reference": ["684c87fed1a24c21a3de8c55dace39cd"],
          },
        } as Page1,
        {
          id: "c5d5e80b289646e0a28ee13fd48d1e5d",
          src: "11111111111111111111111111111111",
          collection: "pages",
          changedAt: 1716353820000,
          createdAt: 1711864560000,
          props: {
            Title: "Bar",
            Slug: "/bar",
            Description: "B",
            Color: "blue",
            "Self Reference": ["1c9435246b15431d9a3b0f91f9ce34d2"],
            "Other Reference": [],
          },
        } as Page1,
      ]);
    });
  });
});
