import { EventType } from "@contfu/core";
import { describe, expect, it } from "bun:test";
import { mockClient } from "../../../test/mocks/notion";
import { SourceType } from "../../data/data";
import { idFromRef, refFromUuid } from "../mappings";
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

      const ref1 = refFromUuid(dbQueryPage1.results[0].id);
      const ref2 = refFromUuid(dbQueryPage1.results[1].id);
      const otherRef = refFromUuid(
        dbQueryPage1.results[0].properties["Other Reference"].relation[0].id
      );
      expect(await events).toEqual([
        {
          type: EventType.CHANGED,
          collection: 1,
          item: {
            id: idFromRef(ref1),
            ref: ref1,
            collection: 1,
            changedAt: 1716353760000,
            createdAt: 1711864560000,
            props: {
              color: "red",
              description: "A",
              otherReference: [otherRef],
              selfReference: [ref2],
              title: "Foo",
            },
          },
          account: 1,
        },
        {
          type: EventType.CHANGED,
          collection: 1,
          item: {
            id: idFromRef(ref2),
            ref: ref2,
            collection: 1,
            changedAt: 1716353820000,
            createdAt: 1711864560000,
            props: {
              color: "blue",
              description: "B",
              otherReference: [],
              selfReference: [ref1],
              slug: "/bar",
              title: "Bar",
            },
          },
          account: 1,
        },
      ]);
    });
  });
});
