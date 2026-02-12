import { describe, expect, it, mock, beforeEach } from "bun:test";
import { type SitemapEntry, buildSitemapUrl, extractUrlsFromEntries } from "./web-sitemap";
import { WebAuthType } from "./web";

// Mock Sitemapper module
type SitemapSite =
  | string
  | { loc: string; lastmod?: string; changefreq?: string; priority?: string };
type SitemapError = { type: string; url: string };
const mockFetchFn = mock(() =>
  Promise.resolve({ sites: [] as SitemapSite[], errors: [] as SitemapError[] }),
);

const MockSitemapper = mock(() => ({
  fetch: mockFetchFn,
}));

// Apply mock before importing the module under test
await mock.module("sitemapper", () => ({
  default: MockSitemapper,
}));

// Import the function to test after mocking
const { fetchSitemap } = await import("./web-sitemap");

describe("web-sitemap", () => {
  beforeEach(() => {
    MockSitemapper.mockClear();
    mockFetchFn.mockClear();
    mockFetchFn.mockResolvedValue({ sites: [], errors: [] });
  });

  describe("buildSitemapUrl()", () => {
    it("should append /sitemap.xml to base URL", () => {
      expect(buildSitemapUrl("https://example.com")).toBe("https://example.com/sitemap.xml");
    });

    it("should remove trailing slash before appending", () => {
      expect(buildSitemapUrl("https://example.com/")).toBe("https://example.com/sitemap.xml");
    });

    it("should remove multiple trailing slashes", () => {
      expect(buildSitemapUrl("https://example.com///")).toBe("https://example.com/sitemap.xml");
    });

    it("should preserve base URL path", () => {
      expect(buildSitemapUrl("https://example.com/docs")).toBe(
        "https://example.com/docs/sitemap.xml",
      );
    });

    it("should use custom sitemap path when provided", () => {
      expect(buildSitemapUrl("https://example.com", "/custom-sitemap.xml")).toBe(
        "https://example.com/custom-sitemap.xml",
      );
    });

    it("should handle custom path without leading slash", () => {
      expect(buildSitemapUrl("https://example.com", "sitemap-index.xml")).toBe(
        "https://example.com/sitemap-index.xml",
      );
    });

    it("should return absolute URL unchanged when provided as custom path", () => {
      expect(buildSitemapUrl("https://example.com", "https://cdn.example.com/sitemap.xml")).toBe(
        "https://cdn.example.com/sitemap.xml",
      );
    });

    it("should handle http URL as custom path", () => {
      expect(buildSitemapUrl("https://example.com", "http://other.com/sitemap.xml")).toBe(
        "http://other.com/sitemap.xml",
      );
    });

    it("should handle nested custom paths", () => {
      expect(buildSitemapUrl("https://example.com", "/sitemaps/main.xml")).toBe(
        "https://example.com/sitemaps/main.xml",
      );
    });
  });

  describe("extractUrlsFromEntries()", () => {
    const sampleEntries: SitemapEntry[] = [
      { url: "https://example.com/page1", lastModified: 1700000000000 },
      { url: "https://example.com/page2", lastModified: 1600000000000 },
      { url: "https://example.com/page3" }, // No lastModified
      { url: "https://example.com/page4", lastModified: 1650000000000 },
    ];

    it("should return all URLs when no since filter", () => {
      const urls = extractUrlsFromEntries(sampleEntries);
      expect(urls).toEqual([
        "https://example.com/page1",
        "https://example.com/page2",
        "https://example.com/page3",
        "https://example.com/page4",
      ]);
    });

    it("should filter entries modified after since timestamp", () => {
      const urls = extractUrlsFromEntries(sampleEntries, 1650000000000);
      expect(urls).toEqual([
        "https://example.com/page1", // Modified after since
        "https://example.com/page3", // No lastModified - included
      ]);
    });

    it("should include entries without lastModified when filtering", () => {
      const urls = extractUrlsFromEntries(sampleEntries, 1800000000000);
      expect(urls).toEqual(["https://example.com/page3"]);
    });

    it("should return all URLs when since is 0", () => {
      const urls = extractUrlsFromEntries(sampleEntries, 0);
      expect(urls).toEqual([
        "https://example.com/page1",
        "https://example.com/page2",
        "https://example.com/page3",
        "https://example.com/page4",
      ]);
    });

    it("should return empty array for empty entries", () => {
      expect(extractUrlsFromEntries([])).toEqual([]);
    });

    it("should return empty array for empty entries with since filter", () => {
      expect(extractUrlsFromEntries([], 1700000000000)).toEqual([]);
    });

    it("should exclude entries exactly at since timestamp", () => {
      const entries: SitemapEntry[] = [
        { url: "https://example.com/page1", lastModified: 1700000000000 },
        { url: "https://example.com/page2", lastModified: 1700000000001 },
      ];
      const urls = extractUrlsFromEntries(entries, 1700000000000);
      expect(urls).toEqual(["https://example.com/page2"]);
    });
  });

  describe("fetchSitemap()", () => {
    it("should create Sitemapper with correct options", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml");

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/sitemap.xml",
          debug: false,
          fields: {
            loc: true,
            lastmod: true,
            changefreq: true,
            priority: true,
          },
        }),
      );
    });

    it("should use default timeout of 30000ms", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml");

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 30000,
        }),
      );
    });

    it("should use custom timeout when provided", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml", { timeout: 5000 });

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 5000,
        }),
      );
    });

    it("should include Authorization header for Bearer auth", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml", {
        authType: WebAuthType.BEARER,
        credentials: Buffer.from("my-secret-token", "utf8"),
      });

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.objectContaining({
          requestHeaders: {
            Authorization: "Bearer my-secret-token",
          },
        }),
      );
    });

    it("should include Authorization header for Basic auth", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml", {
        authType: WebAuthType.BASIC,
        credentials: Buffer.from("dXNlcjpwYXNz", "utf8"), // base64 of "user:pass"
      });

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.objectContaining({
          requestHeaders: {
            Authorization: "Basic dXNlcjpwYXNz",
          },
        }),
      );
    });

    it("should not include Authorization header when authType is NONE", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml", {
        authType: WebAuthType.NONE,
        credentials: Buffer.from("ignored", "utf8"),
      });

      expect(MockSitemapper).toHaveBeenCalledWith(
        expect.not.objectContaining({
          requestHeaders: expect.anything(),
        }),
      );
    });

    it("should return success with empty entries for empty sitemap", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result).toEqual({
        success: true,
        entries: [],
        url: "https://example.com/sitemap.xml",
      });
    });

    it("should parse string URLs from sitemap", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          "https://example.com/page1",
          "https://example.com/page2",
          "https://example.com/page3",
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries).toEqual([
        { url: "https://example.com/page1" },
        { url: "https://example.com/page2" },
        { url: "https://example.com/page3" },
      ]);
    });

    it("should parse sitemap entries with metadata", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          {
            loc: "https://example.com/page1",
            lastmod: "2024-01-15T12:00:00Z",
            changefreq: "weekly",
            priority: "0.8",
          },
          {
            loc: "https://example.com/page2",
            lastmod: "2024-01-10",
            changefreq: "monthly",
            priority: "0.5",
          },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({
        url: "https://example.com/page1",
        lastModified: new Date("2024-01-15T12:00:00Z").getTime(),
        changeFreq: "weekly",
        priority: 0.8,
      });
      expect(result.entries[1]).toEqual({
        url: "https://example.com/page2",
        lastModified: new Date("2024-01-10").getTime(),
        changeFreq: "monthly",
        priority: 0.5,
      });
    });

    it("should handle entries with partial metadata", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          {
            loc: "https://example.com/page1",
            lastmod: "2024-01-15",
            // No changefreq or priority
          },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries[0]).toEqual({
        url: "https://example.com/page1",
        lastModified: new Date("2024-01-15").getTime(),
        changeFreq: undefined,
        priority: undefined,
      });
    });

    it("should handle invalid lastmod date gracefully", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          {
            loc: "https://example.com/page1",
            lastmod: "not-a-valid-date",
          },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries[0]).toEqual({
        url: "https://example.com/page1",
        lastModified: undefined,
        changeFreq: undefined,
        priority: undefined,
      });
    });

    it("should handle invalid priority value gracefully", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          {
            loc: "https://example.com/page1",
            priority: "invalid",
          },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries[0].priority).toBeUndefined();
    });

    it("should clamp priority to 0.0-1.0 range", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          { loc: "https://example.com/page1", priority: "1.5" },
          { loc: "https://example.com/page2", priority: "-0.5" },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries[0].priority).toBe(1);
      expect(result.entries[1].priority).toBe(0);
    });

    it("should return failure when sitemap has errors", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [],
        errors: [
          { type: "error", url: "https://example.com/sitemap.xml" },
          { type: "warning", url: "https://example.com/another.xml" },
        ],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Sitemap errors:");
      expect(result.error).toContain("error: https://example.com/sitemap.xml");
      expect(result.entries).toEqual([]);
    });

    it("should return failure for 404 not found", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("404 Not Found"));

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sitemap not found (404)");
      expect(result.entries).toEqual([]);
    });

    it("should return failure for timeout", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("Request timeout"));

      const result = await fetchSitemap("https://example.com/sitemap.xml", { timeout: 5000 });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sitemap request timed out after 5000ms");
    });

    it("should return failure for ETIMEDOUT error", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("connect ETIMEDOUT"));

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("should return failure for 401 unauthorized", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("401 Unauthorized"));

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required or credentials invalid");
    });

    it("should return failure for 403 forbidden", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("403 Forbidden"));

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access forbidden");
    });

    it("should return failure for generic errors", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("Network connection lost"));

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch sitemap: Network connection lost");
    });

    it("should handle non-Error exceptions", async () => {
      mockFetchFn.mockRejectedValueOnce("string error");

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error fetching sitemap");
    });

    it("should include URL in all results", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.url).toBe("https://example.com/sitemap.xml");
    });

    it("should include URL in error results", async () => {
      mockFetchFn.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchSitemap("https://example.com/custom-sitemap.xml");

      expect(result.url).toBe("https://example.com/custom-sitemap.xml");
    });

    it("should fetch with the provided URL", async () => {
      mockFetchFn.mockResolvedValueOnce({ sites: [], errors: [] });

      await fetchSitemap("https://example.com/sitemap.xml");

      expect(mockFetchFn).toHaveBeenCalledWith("https://example.com/sitemap.xml");
    });

    it("should handle mixed string and object sites", async () => {
      mockFetchFn.mockResolvedValueOnce({
        sites: [
          "https://example.com/page1",
          {
            loc: "https://example.com/page2",
            lastmod: "2024-01-15",
          },
        ],
        errors: [],
      });

      const result = await fetchSitemap("https://example.com/sitemap.xml");

      expect(result.success).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0]).toEqual({ url: "https://example.com/page1" });
      expect(result.entries[1].url).toBe("https://example.com/page2");
      expect(result.entries[1].lastModified).toBeDefined();
    });
  });
});
