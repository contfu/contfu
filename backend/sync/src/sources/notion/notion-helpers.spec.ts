import { describe, expect, it, beforeEach } from "bun:test";
import { dbQueryPage1, dbQueryResult1 } from "./__fixtures__/notion-query-results";
import { mockClient } from "./__tests__/notion-mock-setup";

// Import after mock setup
const { getImageUrl, iterateDb } = await import("./notion-helpers");

describe("notion-helpers", () => {
  beforeEach(() => {
    mockClient.databases.query.mockClear();
    mockClient.blocks.children.list.mockClear();
  });

  describe("getImageUrl()", () => {
    it("should return file URL for file type images", () => {
      const img = {
        type: "file" as const,
        file: { url: "https://prod-files-secure.s3.us-west-2.amazonaws.com/image.png" },
      };
      expect(getImageUrl(img)).toBe(
        "https://prod-files-secure.s3.us-west-2.amazonaws.com/image.png",
      );
    });

    it("should return external URL for external type images", () => {
      const img = {
        type: "external" as const,
        external: { url: "https://example.com/external-image.png" },
      };
      expect(getImageUrl(img)).toBe("https://example.com/external-image.png");
    });

    it("should return undefined for images without type", () => {
      const img = {} as unknown as Parameters<typeof getImageUrl>[0];
      expect(getImageUrl(img)).toBeUndefined();
    });

    it("should handle file type with complex URL", () => {
      const img = {
        type: "file" as const,
        file: {
          url: "https://prod-files-secure.s3.us-west-2.amazonaws.com/abc123/def456/image.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD",
        },
      };
      expect(getImageUrl(img)).toContain("prod-files-secure.s3.us-west-2.amazonaws.com");
      expect(getImageUrl(img)).toContain("X-Amz-Algorithm");
    });

    it("should handle external type with various URL formats", () => {
      const httpImg = {
        type: "external" as const,
        external: { url: "http://example.com/image.jpg" },
      };
      expect(getImageUrl(httpImg)).toBe("http://example.com/image.jpg");

      const httpsImg = {
        type: "external" as const,
        external: { url: "https://cdn.example.com/path/to/image.webp" },
      };
      expect(getImageUrl(httpsImg)).toBe("https://cdn.example.com/path/to/image.webp");
    });
  });

  describe("iterateDb()", () => {
    const testKey = Buffer.from("test-api-key-hex-encoded", "utf8");
    const testRef = Buffer.from("database-id-here", "utf8");

    it("should iterate through database pages", async () => {
      mockClient.databases.query.mockResolvedValueOnce(dbQueryPage1);

      const pages = [];
      for await (const page of iterateDb(testKey, testRef)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(pages[0].id).toBe(dbQueryResult1.id);
    });

    it("should handle empty database", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        object: "list",
        results: [],
        next_cursor: null,
        has_more: false,
      });

      const pages = [];
      for await (const page of iterateDb(testKey, testRef)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(0);
    });

    it("should handle pagination across multiple pages", async () => {
      const page1Results = {
        object: "list",
        results: [dbQueryResult1],
        next_cursor: "cursor-123",
        has_more: true,
      };

      const page2Results = {
        object: "list",
        results: [{ ...dbQueryResult1, id: "second-page-id" }],
        next_cursor: null,
        has_more: false,
      };

      mockClient.databases.query
        .mockResolvedValueOnce(page1Results)
        .mockResolvedValueOnce(page2Results);

      const pages = [];
      for await (const page of iterateDb(testKey, testRef)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(2);
      expect(mockClient.databases.query).toHaveBeenCalledTimes(2);
    });

    it("should pass filter parameters", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        object: "list",
        results: [],
        next_cursor: null,
        has_more: false,
      });

      const filter = {
        property: "Status",
        select: { equals: "Published" },
      };

      await Array.fromAsync(iterateDb(testKey, testRef, { filter }));

      expect(mockClient.databases.query).toHaveBeenCalled();
    });

    it("should pass sort parameters", async () => {
      mockClient.databases.query.mockResolvedValueOnce({
        object: "list",
        results: [],
        next_cursor: null,
        has_more: false,
      });

      const sorts = [{ timestamp: "created_time" as const, direction: "ascending" as const }];

      await Array.fromAsync(iterateDb(testKey, testRef, { sorts }));

      expect(mockClient.databases.query).toHaveBeenCalled();
    });

    it("should filter out non-page objects", async () => {
      const mixedResults = {
        object: "list",
        results: [
          dbQueryResult1,
          { object: "database", id: "db-123" }, // Should be filtered out
        ],
        next_cursor: null,
        has_more: false,
      };

      mockClient.databases.query.mockResolvedValueOnce(mixedResults);

      const pages = [];
      for await (const page of iterateDb(testKey, testRef)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe(dbQueryResult1.id);
    });

    it("should filter out partial page objects", async () => {
      const partialPageResults = {
        object: "list",
        results: [
          dbQueryResult1,
          { object: "page", id: "partial-123" }, // No properties = not a full page
        ],
        next_cursor: null,
        has_more: false,
      };

      mockClient.databases.query.mockResolvedValueOnce(partialPageResults);

      const pages = [];
      for await (const page of iterateDb(testKey, testRef)) {
        pages.push(page);
      }

      expect(pages).toHaveLength(1);
    });
  });
});
