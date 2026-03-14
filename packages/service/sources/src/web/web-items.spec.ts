import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import type { Item, PageProps } from "@contfu/core";

const { iterateItems, parseWebPage } = await import("./web-items");

const originalFetch = globalThis.fetch;
const mockFetch = mock(() => Promise.resolve(new Response()));

beforeEach(() => {
  mockFetch.mockClear();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

async function collectItems(opts: Parameters<typeof iterateItems>[0]): Promise<Item[]> {
  const items: Item[] = [];
  for await (const item of iterateItems(opts)) {
    items.push(item);
  }
  return items;
}

function props(item: Item): PageProps {
  return item.props as PageProps;
}

describe("web-items", () => {
  describe("regular URL fetching", () => {
    it("should fetch and parse regular URLs", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("<html><head><title>Page</title></head><body>Content</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        }),
      );

      const items = await collectItems({
        collection: 1,
        ref: Buffer.from("https://example.com/page1", "utf8"),
        url: "https://example.com",
      });

      expect(items).toHaveLength(1);
      expect(props(items[0]).title).toBe("Page");
    });
  });

  describe("304 handling", () => {
    it("should skip items when server returns 304", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(null, { status: 304, statusText: "Not Modified" }),
      );

      const items = await collectItems({
        collection: 1,
        ref: Buffer.from("https://example.com/page1", "utf8"),
        url: "https://example.com",
        since: Date.now() - 60000,
      });

      expect(items).toHaveLength(0);
    });
  });

  describe("field extraction", () => {
    it("should extract absolute favicon URL from <link rel=icon>", () => {
      const item = parseWebPage(
        {
          url: "https://example.com/page",
          body: '<html><head><link rel="icon" href="/img/icon.png"></head><body>Hi</body></html>',
          contentType: "text/html",
        },
        1,
      );
      expect(props(item).favicon).toBe("https://example.com/img/icon.png");
    });

    it("should fall back to /favicon.ico when no favicon link present", () => {
      const item = parseWebPage(
        {
          url: "https://example.com/page",
          body: "<html><head></head><body>Hi</body></html>",
          contentType: "text/html",
        },
        1,
      );
      expect(props(item).favicon).toBe("https://example.com/favicon.ico");
    });

    it("should extract plain text content from <article>", () => {
      const item = parseWebPage(
        {
          url: "https://example.com/page",
          body: "<html><body><article>Hello world</article></body></html>",
          contentType: "text/html",
        },
        1,
      );
      expect(props(item).content).toBe("Hello world");
    });

    it("markdown item: content equals markdown body, favicon is not set", () => {
      const md = "# Title\n\nSome text here.";
      const item = parseWebPage(
        { url: "https://example.com/doc.md", body: md, contentType: "text/markdown" },
        1,
      );
      expect(props(item).favicon).toBeUndefined();
      expect(props(item).content).toBe(md.trim());
    });

    it("json item: favicon and content are not set", () => {
      const item = parseWebPage(
        {
          url: "https://example.com/api/data.json",
          body: '{"key":"value"}',
          contentType: "application/json",
        },
        1,
      );
      expect(props(item).favicon).toBeUndefined();
      expect(props(item).content).toBeUndefined();
    });
  });
});
