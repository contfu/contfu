import { EventType } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { firstValueFrom, toArray } from "rxjs";
import { mockClient } from "../../../test/mocks/notion";
import { SourceType } from "../../data/data";
import { idFromRef, refFromUuid } from "../mappings";
import { dbQueryPage1 } from "./__fixtures__/notion-query-results";
import type { NotionPullOpts } from "./notion";
import { NotionSource } from "./notion-source";
const pullOpts: NotionPullOpts = {
  account: 1,
  source: 1,
  collection: 1,
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

      const events = firstValueFrom(source.fetch(pullOpts).pipe(toArray()));

      const id1 = idFromRef(refFromUuid(dbQueryPage1.results[0].id));
      const id2 = idFromRef(refFromUuid(dbQueryPage1.results[1].id));
      const otherId = idFromRef(
        refFromUuid(
          dbQueryPage1.results[0].properties["Other Reference"].relation[0].id
        )
      );
      expect(await events).toEqual([
        {
          type: EventType.CREATED,
          collection: 1,
          item: {
            id: id1,
            collection: 1,
            changedAt: 1716353760000,
            createdAt: 1711864560000,
            props: {
              Color: "red",
              Description: "A",
              "Other Reference": [otherId.toString("base64url")],
              "Self Reference": [id2.toString("base64url")],
              Title: "Foo",
            },
          },
          account: 1,
        },
        {
          type: EventType.CREATED,
          collection: 1,
          item: {
            id: id2,
            collection: 1,
            changedAt: 1716353820000,
            createdAt: 1711864560000,
            props: {
              Color: "blue",
              Description: "B",
              "Other Reference": [],
              "Self Reference": [id1.toString("base64url")],
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
