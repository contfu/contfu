import { describe, expect, it, mock, beforeEach } from "bun:test";
import {
  resolveUrl,
  extractSlugFromUrl,
  buildAuthHeader,
  getContentProcessor,
  parseRefUrls,
  normalizeBaseUrl,
  isSitemapUrl,
} from "./web-helpers";
import { WebAuthType } from "./web";

// Mock fetch globally
const mockFetch = mock(() => Promise.resolve(new Response()));

// Store original fetch
const originalFetch = globalThis.fetch;

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

// Import functions that use fetch after mock setup
const { webFetch, testWebConnection } = await import("./web-helpers");

describe("web-helpers", () => {
  describe("resolveUrl()", () => {
    it("should return absolute URLs unchanged", () => {
      expect(resolveUrl("https://example.com/page", "https://base.com")).toBe(
        "https://example.com/page",
      );
      expect(resolveUrl("http://example.com/page", "https://base.com")).toBe(
        "http://example.com/page",
      );
    });

    it("should resolve relative URLs against base URL", () => {
      expect(resolveUrl("/blog/article", "https://example.com")).toBe(
        "https://example.com/blog/article",
      );
    });

    it("should handle base URL with trailing slash", () => {
      expect(resolveUrl("/blog/article", "https://example.com/")).toBe(
        "https://example.com/blog/article",
      );
    });

    it("should handle base URL with path", () => {
      expect(resolveUrl("/page", "https://example.com/docs/")).toBe("https://example.com/page");
    });

    it("should resolve relative paths without leading slash", () => {
      expect(resolveUrl("article.html", "https://example.com/blog/")).toBe(
        "https://example.com/blog/article.html",
      );
    });

    it("should handle complex relative paths", () => {
      expect(resolveUrl("../images/logo.png", "https://example.com/docs/guide/")).toBe(
        "https://example.com/docs/images/logo.png",
      );
    });
  });

  describe("extractSlugFromUrl()", () => {
    it("should extract slug from URL with file extension", () => {
      expect(extractSlugFromUrl("https://example.com/blog/my-article.html")).toBe("my-article");
    });

    it("should extract slug from URL without extension", () => {
      expect(extractSlugFromUrl("https://example.com/docs/getting-started")).toBe(
        "getting-started",
      );
    });

    it("should handle trailing slash", () => {
      expect(extractSlugFromUrl("https://example.com/api/users/")).toBe("users");
    });

    it("should return 'index' for root path", () => {
      expect(extractSlugFromUrl("https://example.com/")).toBe("index");
    });

    it("should return 'unknown' for invalid URLs", () => {
      expect(extractSlugFromUrl("not-a-valid-url")).toBe("unknown");
    });

    it("should handle URL with query params", () => {
      expect(extractSlugFromUrl("https://example.com/page?foo=bar")).toBe("page");
    });

    it("should handle URL with hash", () => {
      expect(extractSlugFromUrl("https://example.com/page#section")).toBe("page");
    });

    it("should handle nested paths", () => {
      expect(extractSlugFromUrl("https://example.com/a/b/c/deep-page")).toBe("deep-page");
    });
  });

  describe("buildAuthHeader()", () => {
    it("should return undefined when authType is NONE", () => {
      const credentials = Buffer.from("test-token", "utf8");
      expect(buildAuthHeader(WebAuthType.NONE, credentials)).toBeUndefined();
    });

    it("should return undefined when authType is undefined", () => {
      const credentials = Buffer.from("test-token", "utf8");
      expect(buildAuthHeader(undefined, credentials)).toBeUndefined();
    });

    it("should return undefined when credentials are undefined", () => {
      expect(buildAuthHeader(WebAuthType.BEARER, undefined)).toBeUndefined();
    });

    it("should build Bearer auth header", () => {
      const credentials = Buffer.from("my-token-123", "utf8");
      expect(buildAuthHeader(WebAuthType.BEARER, credentials)).toBe("Bearer my-token-123");
    });

    it("should build Basic auth header", () => {
      const credentials = Buffer.from("dXNlcjpwYXNz", "utf8"); // base64 of "user:pass"
      expect(buildAuthHeader(WebAuthType.BASIC, credentials)).toBe("Basic dXNlcjpwYXNz");
    });
  });

  describe("getContentProcessor()", () => {
    it("should return 'html' for text/html content type", () => {
      expect(getContentProcessor("text/html")).toBe("html");
      expect(getContentProcessor("text/html; charset=utf-8")).toBe("html");
    });

    it("should return 'markdown' for markdown content types", () => {
      expect(getContentProcessor("text/markdown")).toBe("markdown");
      expect(getContentProcessor("text/x-markdown")).toBe("markdown");
      expect(getContentProcessor("text/markdown; charset=utf-8")).toBe("markdown");
    });

    it("should return 'json' for JSON content type", () => {
      expect(getContentProcessor("application/json")).toBe("json");
      expect(getContentProcessor("application/json; charset=utf-8")).toBe("json");
    });

    it("should return null for unsupported content types", () => {
      expect(getContentProcessor("text/plain")).toBeNull();
      expect(getContentProcessor("application/xml")).toBeNull();
      expect(getContentProcessor("image/png")).toBeNull();
    });

    it("should be case insensitive", () => {
      expect(getContentProcessor("TEXT/HTML")).toBe("html");
      expect(getContentProcessor("Application/JSON")).toBe("json");
    });
  });

  describe("parseRefUrls()", () => {
    it("should parse single URL", () => {
      const ref = Buffer.from("/blog/article", "utf8");
      expect(parseRefUrls(ref)).toEqual(["/blog/article"]);
    });

    it("should parse multiple URLs", () => {
      const ref = Buffer.from("/blog/article1\n/blog/article2\n/blog/article3", "utf8");
      expect(parseRefUrls(ref)).toEqual(["/blog/article1", "/blog/article2", "/blog/article3"]);
    });

    it("should return empty array for empty buffer", () => {
      const ref = Buffer.from("", "utf8");
      expect(parseRefUrls(ref)).toEqual([]);
    });

    it("should trim whitespace from URLs", () => {
      const ref = Buffer.from("  /blog/article1  \n  /blog/article2  ", "utf8");
      expect(parseRefUrls(ref)).toEqual(["/blog/article1", "/blog/article2"]);
    });

    it("should filter empty lines", () => {
      const ref = Buffer.from("/blog/article1\n\n/blog/article2\n\n", "utf8");
      expect(parseRefUrls(ref)).toEqual(["/blog/article1", "/blog/article2"]);
    });

    it("should handle whitespace-only content", () => {
      const ref = Buffer.from("   \n   \n   ", "utf8");
      expect(parseRefUrls(ref)).toEqual([]);
    });
  });

  describe("normalizeBaseUrl()", () => {
    it("should remove trailing slash", () => {
      expect(normalizeBaseUrl("https://example.com/")).toBe("https://example.com");
    });

    it("should remove multiple trailing slashes", () => {
      expect(normalizeBaseUrl("https://example.com///")).toBe("https://example.com");
    });

    it("should return URL unchanged if no trailing slash", () => {
      expect(normalizeBaseUrl("https://example.com")).toBe("https://example.com");
    });

    it("should preserve path segments", () => {
      expect(normalizeBaseUrl("https://example.com/api/v1/")).toBe("https://example.com/api/v1");
    });
  });

  describe("isSitemapUrl()", () => {
    it("should return true for .xml URLs", () => {
      expect(isSitemapUrl("https://example.com/sitemap.xml")).toBe(true);
    });

    it("should return true for .xml.gz URLs", () => {
      expect(isSitemapUrl("https://example.com/sitemap.xml.gz")).toBe(true);
    });

    it("should return true for URLs containing 'sitemap'", () => {
      expect(isSitemapUrl("https://example.com/sitemap-index")).toBe(true);
      expect(isSitemapUrl("https://example.com/my-sitemap")).toBe(true);
    });

    it("should return false for regular URLs", () => {
      expect(isSitemapUrl("https://example.com/blog/article")).toBe(false);
      expect(isSitemapUrl("https://example.com/page.html")).toBe(false);
    });

    it("should be case insensitive", () => {
      expect(isSitemapUrl("https://example.com/Sitemap.XML")).toBe(true);
    });

    it("should handle relative URLs", () => {
      expect(isSitemapUrl("/sitemap.xml")).toBe(true);
      expect(isSitemapUrl("/blog/article")).toBe(false);
    });
  });

  describe("webFetch()", () => {
    const baseOptions = {
      baseUrl: "https://example.com",
    };

    it("should fetch URL with correct headers", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: {
            "Content-Type": "text/html",
          },
        }),
      );

      await webFetch("/page", baseOptions);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("https://example.com/page");
      expect(options.headers).toEqual({
        Accept: "text/html, text/markdown, application/json, */*",
      });
    });

    it("should include Authorization header when credentials provided", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      await webFetch("/page", {
        ...baseOptions,
        authType: WebAuthType.BEARER,
        credentials: Buffer.from("my-token", "utf8"),
      });

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toEqual({
        Accept: "text/html, text/markdown, application/json, */*",
        Authorization: "Bearer my-token",
      });
    });

    it("should return response body and metadata", async () => {
      const responseBody = "<html><body>Hello</body></html>";
      mockFetch.mockResolvedValueOnce(
        new Response(responseBody, {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Last-Modified": "Wed, 21 Oct 2015 07:28:00 GMT",
          },
        }),
      );

      const result = await webFetch("/page", baseOptions);

      expect(result).not.toBeNull();
      expect(result!.body).toBe(responseBody);
      expect(result!.contentType).toBe("text/html; charset=utf-8");
      expect(result!.status).toBe(200);
      expect(result!.lastModified).toBe("Wed, 21 Oct 2015 07:28:00 GMT");
    });

    it("should throw on HTTP error", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Not Found", {
          status: 404,
          statusText: "Not Found",
        }),
      );

      await expect(webFetch("/missing", baseOptions)).rejects.toThrow(
        "Web fetch error: 404 Not Found",
      );
    });

    it("should return null on 304 Not Modified", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 304, statusText: "Not Modified" }),
      );

      const result = await webFetch("/page", baseOptions);
      expect(result).toBeNull();
    });

    it("should send If-Modified-Since header when since is provided", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const since = new Date("2024-01-01T00:00:00Z").getTime();
      await webFetch("/page", { ...baseOptions, since });

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["If-Modified-Since"]).toBe(new Date(since).toUTCString());
    });

    it("should throw on 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("Unauthorized", {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      await expect(webFetch("/protected", baseOptions)).rejects.toThrow(
        "Web fetch error: 401 Unauthorized",
      );
    });
  });

  describe("testWebConnection()", () => {
    it("should return success for successful connection", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
      );

      const result = await testWebConnection("https://example.com");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Successfully connected to web source");
    });

    it("should use HEAD method for connection test", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
      );

      await testWebConnection("https://example.com");

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.method).toBe("HEAD");
    });

    it("should include auth header when credentials provided", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
      );

      await testWebConnection(
        "https://example.com",
        WebAuthType.BEARER,
        Buffer.from("token", "utf8"),
      );

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toEqual({
        Authorization: "Bearer token",
      });
    });

    it("should return failure for 401 unauthorized", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 401,
          statusText: "Unauthorized",
        }),
      );

      const result = await testWebConnection("https://example.com");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid credentials or access denied");
      expect(result.details).toBe("HTTP 401: Unauthorized");
    });

    it("should return failure for 403 forbidden", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 403,
          statusText: "Forbidden",
        }),
      );

      const result = await testWebConnection("https://example.com");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Invalid credentials or access denied");
      expect(result.details).toBe("HTTP 403: Forbidden");
    });

    it("should return failure for other HTTP errors", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 500,
          statusText: "Internal Server Error",
        }),
      );

      const result = await testWebConnection("https://example.com");

      expect(result.success).toBe(false);
      expect(result.message).toBe("HTTP error: 500 Internal Server Error");
    });

    it("should return failure for network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network connection failed"));

      const result = await testWebConnection("https://example.com");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Connection failed");
      expect(result.details).toBe("Network connection failed");
    });

    it("should normalize base URL before testing", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, {
          status: 200,
        }),
      );

      await testWebConnection("https://example.com/");

      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).toBe("https://example.com");
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
