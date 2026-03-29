import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { queryItems, countItems } from "./items";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  exitSpy = spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  exitSpy.mockRestore();
});

describe("queryItems", () => {
  test("fetches items with default params", async () => {
    const response = { data: [{ id: 1 }], meta: { total: 1, limit: 20, offset: 0 } };
    mockFetch.mockResolvedValueOnce(jsonResponse(response));

    await queryItems(["--client-url", "http://localhost:5173"]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("http://localhost:5173/api/items");
    expect(url).toContain("limit=20");
    expect(url).toContain("offset=0");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(response, null, 2));
  });

  test("uses collection-specific path", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 0 } }));

    await queryItems(["--client-url", "http://localhost:5173", "--collection", "blogPosts"]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("/api/collections/blogPosts/items");
  });

  test("passes filter, sort, include, fields, flat params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 0 } }));

    await queryItems([
      "--client-url",
      "http://localhost:5173",
      "--filter",
      "status=published",
      "--sort=-createdAt",
      "--limit",
      "5",
      "--offset",
      "10",
      "--include",
      "content,assets",
      "--fields",
      "title,slug",
      "--flat",
    ]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("filter=status%3Dpublished");
    expect(url).toContain("sort=-createdAt");
    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
    expect(url).toContain("include=content%2Cassets");
    expect(url).toContain("fields=title%2Cslug");
    expect(url).toContain("flat=true");
  });

  test("exits with error when --client-url is missing", async () => {
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(queryItems([])).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("Missing required --client-url flag");
  });
});

describe("countItems", () => {
  test("fetches and prints total count", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ data: [], meta: { total: 42, limit: 0, offset: 0 } }),
    );

    await countItems(["--client-url", "http://localhost:5173"]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("limit=0");
    expect(logSpy).toHaveBeenCalledWith(42);
  });

  test("uses collection path and filter", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 5 } }));

    await countItems([
      "--client-url",
      "http://localhost:5173",
      "--collection",
      "posts",
      "--filter",
      "draft=true",
    ]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("/api/collections/posts/items");
    expect(url).toContain("filter=draft%3Dtrue");
  });

  test("exits with error when --client-url is missing", async () => {
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(countItems([])).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith("Missing required --client-url flag");
  });
});
