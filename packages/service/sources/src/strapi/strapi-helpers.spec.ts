import { describe, expect, it, mock, beforeEach } from "bun:test";
import { buildApiUrl, buildSchemaUrl, getMediaUrl } from "./strapi-helpers";
import type { StrapiFetchOpts, StrapiResponse, StrapiEntry } from "./strapi";
import { entriesPage1, entriesPage2, emptyResponse } from "./__fixtures__/strapi-api-results";

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

// Import functions that use fetch after mock setup
const { fetchEntries, iterateEntries, fetchContentTypeSchema } = await import("./strapi-helpers");

describe("strapi-helpers", () => {
  describe("buildApiUrl()", () => {
    it("should build API URL from content type UID", () => {
      const url = buildApiUrl(
        "https://strapi.example.com",
        Buffer.from("api::article.article", "utf8"),
      );
      expect(url).toBe("https://strapi.example.com/api/articles");
    });

    it("should handle trailing slash in base URL", () => {
      const url = buildApiUrl(
        "https://strapi.example.com/",
        Buffer.from("api::article.article", "utf8"),
      );
      expect(url).toBe("https://strapi.example.com/api/articles");
    });

    it("should handle different content type UIDs", () => {
      expect(buildApiUrl("https://strapi.example.com", Buffer.from("api::post.post", "utf8"))).toBe(
        "https://strapi.example.com/api/posts",
      );

      expect(
        buildApiUrl("https://strapi.example.com", Buffer.from("api::category.category", "utf8")),
      ).toBe("https://strapi.example.com/api/categorys");

      expect(
        buildApiUrl("https://strapi.example.com", Buffer.from("api::author.author", "utf8")),
      ).toBe("https://strapi.example.com/api/authors");
    });
  });

  describe("buildSchemaUrl()", () => {
    it("should build schema URL for content type", () => {
      const url = buildSchemaUrl(
        "https://strapi.example.com",
        Buffer.from("api::article.article", "utf8"),
      );
      expect(url).toBe(
        "https://strapi.example.com/api/content-type-builder/content-types/api::article.article",
      );
    });

    it("should handle trailing slash in base URL", () => {
      const url = buildSchemaUrl(
        "https://strapi.example.com/",
        Buffer.from("api::article.article", "utf8"),
      );
      expect(url).toBe(
        "https://strapi.example.com/api/content-type-builder/content-types/api::article.article",
      );
    });
  });

  describe("getMediaUrl()", () => {
    it("should return absolute URLs unchanged", () => {
      expect(getMediaUrl("https://cdn.example.com/image.png")).toBe(
        "https://cdn.example.com/image.png",
      );
      expect(getMediaUrl("http://cdn.example.com/image.png")).toBe(
        "http://cdn.example.com/image.png",
      );
    });

    it("should prepend base URL to relative URLs", () => {
      expect(getMediaUrl("/uploads/image.png", "https://strapi.example.com")).toBe(
        "https://strapi.example.com/uploads/image.png",
      );
    });

    it("should handle base URL with trailing slash", () => {
      expect(getMediaUrl("/uploads/image.png", "https://strapi.example.com/")).toBe(
        "https://strapi.example.com/uploads/image.png",
      );
    });

    it("should return relative URL if no base URL provided", () => {
      expect(getMediaUrl("/uploads/image.png")).toBe("/uploads/image.png");
    });
  });

  describe("fetchEntries()", () => {
    const testOpts: StrapiFetchOpts = {
      collection: 1,
      ref: Buffer.from("api::article.article", "utf8"),
      url: "https://strapi.example.com",
      credentials: Buffer.from("test-token", "utf8"),
    };

    it("should fetch entries with default parameters", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchEntries(testOpts);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [rawUrl, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const url = decodeURIComponent(rawUrl);

      expect(url).toContain("https://strapi.example.com/api/articles");
      expect(url).toContain("pagination[page]=1");
      expect(url).toContain("pagination[pageSize]=25");
      expect(url).toContain("sort=createdAt:asc");
      expect(url).toContain("populate=*");

      expect(options.headers).toEqual({
        Authorization: "Bearer test-token",
        "Content-Type": "application/json",
      });
    });

    it("should pass custom pagination parameters", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchEntries(testOpts, { page: 3, pageSize: 50 });

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("pagination[page]=3");
      expect(url).toContain("pagination[pageSize]=50");
    });

    it("should pass date filters", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await fetchEntries(testOpts, {
        since: "2024-01-01T00:00:00.000Z",
        until: "2024-12-31T23:59:59.999Z",
      });

      const [rawUrl] = mockFetch.mock.calls[0] as unknown as [string];
      const url = decodeURIComponent(rawUrl);
      expect(url).toContain("filters[updatedAt][$gt]=2024-01-01T00:00:00.000Z");
      expect(url).toContain("filters[updatedAt][$lte]=2024-12-31T23:59:59.999Z");
    });

    it("should throw on API error", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      await expect(fetchEntries(testOpts)).rejects.toThrow("Strapi API error: 401 Unauthorized");
    });
  });

  describe("iterateEntries()", () => {
    const testOpts: StrapiFetchOpts = {
      collection: 1,
      ref: Buffer.from("api::article.article", "utf8"),
      url: "https://strapi.example.com",
      credentials: Buffer.from("test-token", "utf8"),
    };

    it("should iterate through single page of entries", async () => {
      const singlePageResponse: StrapiResponse<StrapiEntry[]> = {
        data: entriesPage1.data,
        meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(singlePageResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const entries = await Array.fromAsync(iterateEntries(testOpts));

      expect(entries).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should iterate through multiple pages of entries", async () => {
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

      const entries = await Array.fromAsync(iterateEntries(testOpts));

      expect(entries).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should handle empty response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(emptyResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const entries = await Array.fromAsync(iterateEntries(testOpts));

      expect(entries).toHaveLength(0);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("fetchContentTypeSchema()", () => {
    it("should fetch content type schema", async () => {
      const schemaResponse = {
        data: {
          uid: "api::article.article",
          apiID: "article",
          kind: "collectionType",
          info: { displayName: "Article", singularName: "article", pluralName: "articles" },
          attributes: {
            title: { type: "string", required: true },
          },
        },
      };

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(schemaResponse), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const schema = await fetchContentTypeSchema(
        "https://strapi.example.com",
        Buffer.from("api::article.article", "utf8"),
        Buffer.from("test-token", "utf8"),
      );

      expect(schema.uid).toBe("api::article.article");
      expect(schema.attributes.title.type).toBe("string");

      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).toBe(
        "https://strapi.example.com/api/content-type-builder/content-types/api::article.article",
      );
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
