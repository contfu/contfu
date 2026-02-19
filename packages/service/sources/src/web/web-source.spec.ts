import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { PageProps } from "@contfu/core";
import { PropertyType } from "@contfu/svc-core";
import { genUid } from "../util/ids";
import { encodeWebRef } from "../util/refs";
import type { WebFetchOpts } from "./web";
import { WebAuthType } from "./web";

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
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

// Import after mock setup
const { WebSource } = await import("./web-source");

// Test fixtures
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Test Page Title</title>
  <meta name="description" content="This is a test page description">
</head>
<body>
  <article>
    <h1>Main Heading</h1>
    <p>This is paragraph content with <strong>bold text</strong>.</p>
    <p>Another paragraph.</p>
  </article>
</body>
</html>
`;

const markdownContent = `# Markdown Title

This is the first paragraph for the description.

## Section Two

- Item 1
- Item 2

Some more content here.
`;

const jsonContent = JSON.stringify({
  title: "JSON Data",
  items: [1, 2, 3],
  nested: { key: "value" },
});

const testOpts: WebFetchOpts = {
  collection: 1,
  ref: Buffer.from("/page1.html\n/page2.html", "utf8"),
  url: "https://example.com",
};

describe("WebSource", () => {
  describe("fetch()", () => {
    it("should fetch all items from multiple URLs", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response(htmlContent, {
            status: 200,
            headers: {
              "Content-Type": "text/html",
              "Last-Modified": "Wed, 15 Jan 2024 10:30:00 GMT",
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(htmlContent, {
            status: 200,
            headers: {
              "Content-Type": "text/html",
              "Last-Modified": "Thu, 16 Jan 2024 10:30:00 GMT",
            },
          }),
        );

      const source = new WebSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      expect(items).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify items have correct structure
      const item1 = items[0];
      expect(item1.collection).toBe(1);
      expect(item1.ref).toEqual(encodeWebRef("https://example.com/page1.html"));
      expect(item1.id).toEqual(genUid(Buffer.from("https://example.com/page1.html", "utf8")));
    });

    it("should return empty when ref has no URLs", async () => {
      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("", "utf8"),
        }),
      );

      expect(items).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should extract title and description from HTML", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/page.html", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      const props = getProps(items[0]);
      expect(props.title).toBe("Test Page Title");
      expect(props.description).toBe("This is a test page description");
      expect(props.slug).toBe("page");
    });

    it("should extract slug correctly from URL path", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html><body>Content</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/blog/my-article.html", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      expect(getProps(items[0]).slug).toBe("my-article");
    });

    it("should convert HTML content to blocks", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/page.html", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      const item = items[0];

      // Content should be converted from HTML
      expect(item.content).toBeDefined();
      expect(Array.isArray(item.content)).toBe(true);
      expect(item.content!.length).toBeGreaterThan(0);
    });

    it("should handle Markdown content correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(markdownContent, {
          status: 200,
          headers: { "Content-Type": "text/markdown" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/doc.md", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      const props = getProps(items[0]);
      expect(props.title).toBe("Markdown Title");
      expect(props.description).toBe("This is the first paragraph for the description.");

      // Content should be converted from Markdown
      expect(items[0].content).toBeDefined();
      expect(Array.isArray(items[0].content)).toBe(true);
    });

    it("should handle JSON content correctly", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(jsonContent, {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/api/data.json", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      const props = getProps(items[0]);
      expect(props.slug).toBe("data");
      expect(props.data).toBe(jsonContent);

      // JSON items don't have content blocks
      expect(items[0].content).toBeUndefined();
    });

    it("should filter items by since timestamp", async () => {
      const oldDate = new Date("2024-01-01T00:00:00.000Z");
      const newDate = new Date("2024-02-01T00:00:00.000Z");

      mockFetch
        .mockResolvedValueOnce(
          new Response(htmlContent, {
            status: 200,
            headers: {
              "Content-Type": "text/html",
              "Last-Modified": oldDate.toUTCString(),
            },
          }),
        )
        .mockResolvedValueOnce(
          new Response(htmlContent, {
            status: 200,
            headers: {
              "Content-Type": "text/html",
              "Last-Modified": newDate.toUTCString(),
            },
          }),
        );

      const source = new WebSource();
      const sinceTimestamp = new Date("2024-01-15T00:00:00.000Z").getTime();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/old-page.html\n/new-page.html", "utf8"),
          since: sinceTimestamp,
        }),
      );

      // Only the newer item should be returned
      expect(items).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should include items when no Last-Modified header", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/page.html", "utf8"),
          since: new Date("2024-01-01T00:00:00.000Z").getTime(),
        }),
      );

      // Item should be included since we can't determine if it's newer
      expect(items).toHaveLength(1);
    });

    it("should skip failed URLs gracefully", async () => {
      mockFetch
        .mockResolvedValueOnce(
          new Response("Not Found", {
            status: 404,
            statusText: "Not Found",
          }),
        )
        .mockResolvedValueOnce(
          new Response(htmlContent, {
            status: 200,
            headers: { "Content-Type": "text/html" },
          }),
        );

      const source = new WebSource();
      const items = await Array.fromAsync(source.fetch(testOpts));

      // Only the successful fetch should return an item
      expect(items).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should use Bearer authentication when configured", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/protected.html", "utf8"),
          credentials: Buffer.from("my-secret-token", "utf8"),
          authType: WebAuthType.BEARER,
        }),
      );

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toMatchObject({
        Authorization: "Bearer my-secret-token",
      });
    });

    it("should use Basic authentication when configured", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const base64Creds = Buffer.from("user:pass").toString("base64");
      const source = new WebSource();
      await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/protected.html", "utf8"),
          credentials: Buffer.from(base64Creds, "utf8"),
          authType: WebAuthType.BASIC,
        }),
      );

      const [, options] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
      expect(options.headers).toMatchObject({
        Authorization: `Basic ${base64Creds}`,
      });
    });

    it("should set createdAt and changedAt from Last-Modified header", async () => {
      const lastModified = "Wed, 15 Jan 2024 10:30:00 GMT";
      const expectedTimestamp = new Date(lastModified).getTime();

      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: {
            "Content-Type": "text/html",
            "Last-Modified": lastModified,
          },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("/page.html", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      expect(items[0].props.createdAt).toBe(expectedTimestamp);
      expect(items[0].changedAt).toBe(expectedTimestamp);
    });

    it("should handle absolute URLs in ref", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(htmlContent, {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const source = new WebSource();
      const items = await Array.fromAsync(
        source.fetch({
          ...testOpts,
          ref: Buffer.from("https://other-site.com/page.html", "utf8"),
        }),
      );

      expect(items).toHaveLength(1);
      const [url] = mockFetch.mock.calls[0] as unknown as [string];
      expect(url).toBe("https://other-site.com/page.html");
    });
  });

  describe("getCollectionSchema()", () => {
    it("should return the standard web page schema", async () => {
      const source = new WebSource();
      const schema = await source.getCollectionSchema(testOpts);

      expect(schema).toHaveProperty("slug");
      expect(schema).toHaveProperty("title");
      expect(schema).toHaveProperty("description");
      expect(schema).toHaveProperty("data");

      // Verify property types
      expect(schema.slug).toBe(PropertyType.STRING);
      expect(schema.title).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.description).toBe(PropertyType.STRING | PropertyType.NULL);
      expect(schema.data).toBe(PropertyType.STRING | PropertyType.NULL);
    });

    it("should not make any fetch calls", async () => {
      const source = new WebSource();
      await source.getCollectionSchema(testOpts);

      // Schema is static, no fetch needed
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});

// Restore original fetch after tests
globalThis.fetch = originalFetch;
