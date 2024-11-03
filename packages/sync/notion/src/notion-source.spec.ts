import { genUid, uuidToBuffer } from "@contfu/sync";
import { describe, expect, it, mock } from "bun:test";
import { type Client, iteratePaginatedAPI } from "notion-client-web-fetch";
import { DeepPartial } from "ts-essentials";
import {
  dbQueryPage1,
  dbQueryResult1,
} from "./__fixtures__/notion-query-results";
import type { NotionFetchOpts } from "./notion";

const pullOpts: NotionFetchOpts = {
  ref: Buffer.alloc(0),
  credentials: Buffer.alloc(0),
  collection: 1,
};

const mockClient = {
  databases: { query: mock() },
  blocks: { children: { list: mock() } },
} satisfies DeepPartial<Client>;

mock.module("notion-client-web-fetch", () => ({
  iteratePaginatedAPI,
  Client: mock(() => mockClient),
}));

const { NotionSource } = await import("./notion-source");
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

      const events = await Array.fromAsync(source.fetch(pullOpts));

      const ref1 = uuidToBuffer(dbQueryPage1.results[0].id);
      const ref2 = uuidToBuffer(dbQueryPage1.results[1].id);
      const id1 = genUid(ref1);
      const id2 = genUid(ref2);
      const otherId = genUid(
        uuidToBuffer(
          dbQueryPage1.results[0].properties["Other Reference"].relation[0].id
        )
      );
      expect(events).toEqual([
        {
          id: id1,
          ref: ref1,
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
        {
          id: id2,
          ref: ref2,
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
      ]);
    });

    it("should get changed pages from a collection, if since is provided", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        ...dbQueryPage1,
        results: [dbQueryResult1],
      });
      mockClient.blocks.children.list.mockResolvedValue({ results: [] });

      const events = await Array.fromAsync(
        source.fetch({ ...pullOpts, since: 1711864560000 })
      );

      const id1 = genUid(uuidToBuffer(dbQueryPage1.results[0].id));
      expect(events).toEqual([expect.objectContaining({ id: id1 })]);
    });
  });
});
