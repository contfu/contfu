import type { Block, Page, PageData } from "@contfu/core";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "bun:test";
import { firstValueFrom, take, toArray } from "rxjs";
import { mockClient } from "../../../test/mocks/notion";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import { NotionConnection } from "./notion-connection";

const schema1 = Type.Object({
  Title: Type.String(),
  Description: Type.String(),
  "Self Reference": Type.String(),
  "Other Reference": Type.String(),
});

type Page1 = Page<{
  content: Block[];
  collection: "pages";
  props: { Color: string };
}>;
const connection = new NotionConnection<{ pages: Page1 }>({
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
      const value = await firstValueFrom(
        connection.pullCollectionRefs("pages")
      );

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
        connection.pull("pages").pipe(take(2), toArray())
      );

      expect(value).toEqual([
        {
          title: "Foo",
          description: "A",
          path: "/pages/foo",
          createdAt: 1711864560000,
          changedAt: 1716353760000,
          publishedAt: 1711864560000,
          collection: "pages",
          content: [],
          props: {
            Color: "red",
            "Self Reference": ["c5d5e80b289646e0a28ee13fd48d1e5d"],
            "Other Reference": ["684c87fed1a24c21a3de8c55dace39cd"],
          },
          id: "1c9435246b15431d9a3b0f91f9ce34d2",
          connection: "11111111111111111111111111111111",
        } as PageData,
        {
          changedAt: 1716353820000,
          collection: "pages",
          content: [],
          createdAt: 1711864560000,
          description: "B",
          props: {
            Color: "blue",
            "Self Reference": ["1c9435246b15431d9a3b0f91f9ce34d2"],
            "Other Reference": [],
          },
          publishedAt: 1711864560000,
          id: "c5d5e80b289646e0a28ee13fd48d1e5d",
          connection: "11111111111111111111111111111111",
          path: "/bar",
          title: "Bar",
        } as PageData,
      ]);
    });
  });
});
