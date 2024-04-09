import { Page } from "@contfu/client";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { describe, expect, it } from "bun:test";
import { mockClient } from "../test/mocks/notion";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import { NotionConnection } from "./notion-connection";

const schema1 = Type.Object({
  Title: Type.String(),
  Description: Type.String(),
  "Self Reference": Type.String(),
  "Other Reference": Type.String(),
});

type Page1 = Page<{
  collection: "pages";
  linkType: "self" | "other";
  attributes: { color: string };
}>;
const connection = new NotionConnection<{ pages: Page1 }>({
  name: "test",
  key: process.env.API_TOKEN!,
  pruneInterval: 60,
  collections: {
    pages: {
      dbId: process.env.NOTION_DB_ID_1!,
      // Add filter for props
      collect: ({ props, ...data }) => {
        const valid = Value.Check(schema1, props);
        if (valid) {
          return {
            ...data,
            title: props.Title,
            description: props.Description,
            links: {
              ...data.links,
              self: [props["Self Reference"]],
              other: [props["Other Reference"]],
            },
            attributes: {
              color: "",
            },
            slug: props.Title.toLowerCase().replace(/ /g, "-"),
          };
        }
        throw new Error("Invalid schema");
      },
    },
  },
});

describe("NotionConnection", () => {
  describe("pullConnectionRefs()", () => {
    it("should get all refs from all collections from notion", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);
      const { value } = await connection.pullCollectionRefs().next();

      expect(value).toEqual([
        "1c943524-6b15-431d-9a3b-0f91f9ce34d2",
        "c5d5e80b-2896-46e0-a28e-e13fd48d1e5d",
      ]);
    });
  });
});
