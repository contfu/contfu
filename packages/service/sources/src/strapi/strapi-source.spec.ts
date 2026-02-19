import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PageProps } from "@contfu/core";
import { genUid } from "../util/ids";
import { encodeStrapiRef } from "../util/refs";
import {
  articleEntry1,
  articleEntry2,
  articleSchema,
  entriesPage1,
  entriesPage2,
} from "./__fixtures__/strapi-api-results";
import type { StrapiEntry, StrapiFetchOpts, StrapiResponse } from "./strapi";

// Helper to get props with correct type
function getProps(item: { props: unknown }): PageProps {
  return item.props as PageProps;
}

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as any;
});

// Import after mock setup
const { StrapiSource } = await import("./strapi-source");

const testOpts: StrapiFetchOpts = {
  collection: 1,
  ref: Buffer.from("api::article.article", "utf8"),
  url: "https://strapi.example.com",
  credentials: Buffer.from("test-token", "utf8"),
};

describe("StrapiSource", () => {
  describe("fetch()", () => {
    it("should fetch all items on initial sync (no since)", async () => {
      const singlePageResponse: StrapiResponse<StrapiEntry[]> = {
        data: [articleEntry1, articleEntry2],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singlePageResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify items have correct structure
      const item1 = items[0];
      expect(item1.collection).toBe(1);
      expect(item1.ref).toEqual(
        encodeStrapiRef({
          baseUrl: testOpts.url,
          contentTypeUid: testOpts.ref,
          documentId: "abc123def456",
        }),
      );
      expect(item1.id).toEqual(genUid(Buffer.from("abc123def456", "utf8")));
      expect(getProps(item1).title).toBe("Getting Started with Strapi");

      const item2 = items[1];
      expect(getProps(item2).title).toBe("Advanced Strapi Features");
    });

    it("should apply until filter for full sync", async () => {
      const emptyResponse: StrapiResponse<StrapiEntry[]> = {
        data: [],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      await Array.fromAsync(source.fetch(testOpts));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("filters[updatedAt][$lte]=");
      expect(url).not.toContain("filters[updatedAt][$gt]=");
    });

    it("should apply since and until filters for incremental sync", async () => {
      const emptyResponse: StrapiResponse<StrapiEntry[]> = {
        data: [],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const sinceTimestamp = new Date("2024-01-01T00:00:00.000Z").getTime();
      await Array.fromAsync(source.fetch({ ...testOpts, since: sinceTimestamp }));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("filters[updatedAt][$gt]=2024-01-01T00:00:00.000Z");
      expect(url).toContain("filters[updatedAt][$lte]=");
    });

    it("should sort by createdAt ascending", async () => {
      const emptyResponse: StrapiResponse<StrapiEntry[]> = {
        data: [],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      await Array.fromAsync(source.fetch(testOpts));

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("sort=createdAt:asc");
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

      const source = new StrapiSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should convert blocks content correctly", async () => {
      const singleEntryResponse: StrapiResponse<StrapiEntry[]> = {
        data: [articleEntry1],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Content should be converted from Strapi blocks
      expect(item.content).toBeDefined();
      expect(Array.isArray(item.content)).toBe(true);

      // First block should be a paragraph
      expect(item.content![0][0]).toBe("p");
    });

    it("should handle entries with relations", async () => {
      const singleEntryResponse: StrapiResponse<StrapiEntry[]> = {
        data: [articleEntry2],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Single relation should be a Buffer
      expect(getProps(item).author.toString()).toEqual(Buffer.from("author001", "utf8").toString());

      // Multiple relations should be an array of base64url strings
      expect(Array.isArray(getProps(item).tags)).toBe(true);
      expect(getProps(item).tags).toHaveLength(2);
    });

    it("should handle entries with media", async () => {
      const singleEntryResponse: StrapiResponse<StrapiEntry[]> = {
        data: [articleEntry2],
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Single media with absolute URL
      expect(getProps(item).featuredImage).toBe("https://cdn.example.com/images/featured.jpg");

      // Multiple media with relative URLs
      expect(getProps(item).gallery).toEqual([
        "https://strapi.example.com/uploads/gallery1.jpg",
        "https://strapi.example.com/uploads/gallery2.jpg",
      ]);
    });
  });

  describe("getCollectionSchema()", () => {
    it("should fetch and return collection schema", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: articleSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      const schema = await source.getCollectionSchema(testOpts);

      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify schema has expected properties
      expect(schema.title).toBeDefined();
      expect(schema.slug).toBeDefined();
      expect(schema.description).toBeDefined();

      // Verify API was called with correct URL
      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).toContain("content-type-builder/content-types/api::article.article");
    });

    it("should use correct authentication", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: articleSchema }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new StrapiSource();
      await source.getCollectionSchema(testOpts);

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toEqual({
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      });
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
