import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PageProps } from "@contfu/core";
import { genUid } from "../util/ids";
import {
  blogPostEntry1,
  blogPostEntry2,
  blogPostSchema,
  entriesPage1,
  entriesPage2,
} from "./__fixtures__/contentful-api-results";
import type { ContentfulEntry, ContentfulFetchOpts, ContentfulResponse } from "./contentful";

function getProps(item: { props: unknown }): PageProps {
  return item.props as PageProps;
}

const mockFetch = mock(() => Promise.resolve(new Response()));

const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
});

const { ContentfulSource } = await import("./contentful-source");

const testOpts: ContentfulFetchOpts = {
  collection: 1,
  ref: Buffer.from("blogPost", "utf8"),
  spaceId: "test-space-id",
  environmentId: "master",
  credentials: Buffer.from("test-access-token", "utf8"),
};

describe("ContentfulSource", () => {
  describe("fetch()", () => {
    it("should fetch all items on initial sync (no since)", async () => {
      const singlePageResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 2, limit: 25, skip: 0 },
        items: [blogPostEntry1, blogPostEntry2],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singlePageResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const item1 = items[0];
      expect(item1.collection).toBe(1);
      expect(item1.ref).toEqual(Buffer.from("abc123def456", "utf8"));
      expect(item1.id).toEqual(genUid(Buffer.from("abc123def456", "utf8")));
      expect(getProps(item1).title).toBe("Getting Started with Contentful");

      const item2 = items[1];
      expect(getProps(item2).title).toBe("Advanced Contentful Features");
    });

    it("should apply until filter for full sync", async () => {
      const emptyResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 0, limit: 25, skip: 0 },
        items: [],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      await Array.fromAsync(source.fetch(testOpts));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("sys.updatedAt[lte]=");
      expect(url).not.toContain("sys.updatedAt[gte]=");
    });

    it("should apply since and until filters for incremental sync", async () => {
      const emptyResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 0, limit: 25, skip: 0 },
        items: [],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      const sinceTimestamp = new Date("2024-01-01T00:00:00.000Z").getTime();
      await Array.fromAsync(source.fetch({ ...testOpts, since: sinceTimestamp }));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("sys.updatedAt[gte]=2024-01-01T00:00:00.000Z");
      expect(url).toContain("sys.updatedAt[lte]=");
    });

    it("should sort by createdAt ascending", async () => {
      const emptyResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 0, limit: 25, skip: 0 },
        items: [],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      await Array.fromAsync(source.fetch(testOpts));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("order=sys.createdAt");
    });

    it("should paginate through multiple pages", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify(entriesPage1), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify(entriesPage2), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      const source = new ContentfulSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should convert rich text content correctly", async () => {
      const singleEntryResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 1, limit: 25, skip: 0 },
        items: [blogPostEntry1],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      expect(item.content).toBeDefined();
      expect(Array.isArray(item.content)).toBe(true);

      expect(item.content![0][0]).toBe("p");
    });

    it("should handle boolean and number fields", async () => {
      const singleEntryResponse: ContentfulResponse<ContentfulEntry> = {
        sys: { type: "Array", total: 1, limit: 25, skip: 0 },
        items: [blogPostEntry2],
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      expect(getProps(item).published).toBe(true);
      expect(getProps(item).views).toBe(1500);
    });
  });

  describe("getCollectionSchema()", () => {
    it("should fetch and return collection schema", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(blogPostSchema), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      const schema = await source.getCollectionSchema(testOpts);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      expect(schema.title).toBeDefined();
      expect(schema.slug).toBeDefined();

      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).toContain("content_types/blogPost");
    });

    it("should use correct authentication", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(blogPostSchema), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new ContentfulSource();
      await source.getCollectionSchema(testOpts);

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toEqual({
        Authorization: "Bearer test-access-token",
        "Content-Type": "application/json-patch+json",
      });
    });
  });
});

globalThis.fetch = originalFetch;
