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
  delete process.env.CONTFU_SERVER_URL;
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

  test("passes filter, search, sort, include, fields, locale, fallback, and flat params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 0 } }));

    await queryItems([
      "--client-url",
      "http://localhost:5173",
      "--filter",
      "status=published",
      "--search",
      "release notes",
      "--sort=-createdAt",
      "--limit",
      "5",
      "--offset",
      "10",
      "--include",
      "content,files",
      "--fields",
      "title,slug",
      "--locale",
      "fr",
      "--fallback",
      "en",
      "--flat",
    ]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("filter=status%3Dpublished");
    expect(url).toContain("search=release+notes");
    expect(url).toContain("sort=-createdAt");
    expect(url).toContain("limit=5");
    expect(url).toContain("offset=10");
    expect(url).toContain("include=content%2Cfiles");
    expect(url).toContain("fields=title%2Cslug");
    expect(url).toContain("locale=fr");
    expect(url).toContain("fallback=en");
    expect(url).toContain("flat=true");
  });

  test("uses CONTFU_SERVER_URL when --client-url is missing", async () => {
    process.env.CONTFU_SERVER_URL = "http://localhost:5173";
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 0 } }));

    await queryItems([]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("http://localhost:5173/api/items");
  });

  test("exits with error when no server URL is configured", async () => {
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(queryItems([])).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(
      "Missing required --client-url flag or CONTFU_SERVER_URL",
    );
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

  test("uses collection path, filter, search, and i18n params", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 5 } }));

    await countItems([
      "--client-url",
      "http://localhost:5173",
      "--collection",
      "posts",
      "--filter",
      "draft=true",
      "--search",
      "release",
      "--locale",
      "false",
      "--fallback",
      "false",
    ]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("/api/collections/posts/items");
    expect(url).toContain("filter=draft%3Dtrue");
    expect(url).toContain("search=release");
    expect(url).toContain("locale=false");
    expect(url).toContain("fallback=false");
  });

  test("uses CONTFU_SERVER_URL when --client-url is missing", async () => {
    process.env.CONTFU_SERVER_URL = "http://localhost:5173";
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [], meta: { total: 12 } }));

    await countItems([]);

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toContain("http://localhost:5173/api/items");
    expect(logSpy).toHaveBeenCalledWith(12);
  });

  test("exits with error when no server URL is configured", async () => {
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(countItems([])).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(
      "Missing required --client-url flag or CONTFU_SERVER_URL",
    );
  });
});
