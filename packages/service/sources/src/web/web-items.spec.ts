import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import type { Item } from "@contfu/core";

const { iterateItems } = await import("./web-items");

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
      expect(items[0].props.title).toBe("Page");
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
});
