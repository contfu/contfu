import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PageProps } from "@contfu/core";
import { genUid } from "../util/ids";
import {
  articleEntry1,
  articleEntry2,
  articleEntry3,
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
const { iterateItems } = await import("./strapi-items");

const testOpts: StrapiFetchOpts = {
  collection: 1,
  ref: Buffer.from("api::article.article", "utf8"),
  url: "https://strapi.example.com",
  credentials: Buffer.from("test-token", "utf8"),
};

describe("strapi-items", () => {
  describe("iterateItems()", () => {
    it("should convert basic entry to item", async () => {
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

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Check basic fields
      expect(item.collection).toBe(1);
      expect(item.ref).toEqual(Buffer.from("abc123def456", "utf8"));
      expect(item.id).toEqual(genUid(Buffer.from("abc123def456", "utf8")));
      expect(item.props.createdAt).toBe(new Date("2024-01-10T08:00:00.000Z").getTime());
      expect(item.changedAt).toBe(new Date("2024-01-15T10:30:00.000Z").getTime());
      expect(item.props.publishedAt).toBe(new Date("2024-01-15T10:30:00.000Z").getTime());

      // Check props
      expect(getProps(item).title).toBe("Getting Started with Strapi");
      expect(getProps(item).slug).toBe("getting-started-with-strapi");
      expect(getProps(item).description).toBe("A comprehensive guide to Strapi CMS");

      // Check content was extracted from blocks
      expect(item.content).toBeDefined();
      expect(item.content!.length).toBeGreaterThan(0);
    });

    it("should handle entry without publishedAt", async () => {
      const singleEntryResponse: StrapiResponse<StrapiEntry[]> = {
        data: [articleEntry3], // articleEntry3 has publishedAt: null
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singleEntryResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(1);
      expect(items[0].props.publishedAt).toBeUndefined();
    });

    it("should convert media fields to URLs", async () => {
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

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Single media - absolute URL
      expect(getProps(item).featuredImage).toBe("https://cdn.example.com/images/featured.jpg");

      // Multiple media - relative URLs with base URL prepended
      expect(getProps(item).gallery).toEqual([
        "https://strapi.example.com/uploads/gallery1.jpg",
        "https://strapi.example.com/uploads/gallery2.jpg",
      ]);
    });

    it("should convert relation fields to refs", async () => {
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

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Single relation - Buffer
      expect(getProps(item).author.toString()).toEqual(Buffer.from("author001", "utf8").toString());

      // Multiple relations - array of base64url strings
      expect(getProps(item).tags).toEqual([
        genUid(Buffer.from("tag001", "utf8")).toString("base64url"),
        genUid(Buffer.from("tag002", "utf8")).toString("base64url"),
      ]);
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

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should not include reserved fields in props", async () => {
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

      const items = await Array.fromAsync(iterateItems(testOpts));

      expect(items).toHaveLength(1);
      const item = items[0];

      // Reserved fields should not be in props
      expect(item.props).not.toHaveProperty("id");
      expect(item.props).not.toHaveProperty("documentId");
      expect(item.props).toHaveProperty("createdAt");
      expect(item.props).not.toHaveProperty("updatedAt");
      expect(item.props).toHaveProperty("publishedAt");
    });

    it("should pass query parameters to API", async () => {
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

      await Array.fromAsync(
        iterateItems(testOpts, {
          since: "2024-01-01T00:00:00.000Z",
          until: "2024-12-31T23:59:59.999Z",
        }),
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);

      expect(url).toContain("filters[updatedAt][$gt]=2024-01-01T00:00:00.000Z");
      expect(url).toContain("filters[updatedAt][$lte]=2024-12-31T23:59:59.999Z");
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
