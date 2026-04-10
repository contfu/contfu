import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import {
  addConnectionCollections,
  parseAddRefs,
  printAddSummary,
  scanConnectionCollections,
} from "./connection-collections";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as typeof fetch;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

let logSpy: ReturnType<typeof spyOn>;
let errorSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  process.env.CONTFU_URL = "http://test.local";
  logSpy = spyOn(console, "log").mockImplementation(() => {});
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

describe("parseAddRefs", () => {
  test("parses comma-separated refs", () => {
    expect(parseAddRefs("articles, authors ,,tags")).toEqual(["articles", "authors", "tags"]);
  });
});

describe("scanConnectionCollections", () => {
  test("prints scanned collections as JSON", async () => {
    const collections = [{ ref: "db-1", displayName: "Blog Posts", alreadyAdded: false }];
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));

    await scanConnectionCollections("42", { format: "json" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/connections/42/scan");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(collections, null, 2));
  });

  test("prints scanned collections in table format", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse([
        { ref: "db-1", displayName: "Blog Posts", alreadyAdded: false },
        { ref: "db-2", displayName: "Authors", alreadyAdded: true },
      ]),
    );

    await scanConnectionCollections("42", { format: "table" });

    const calls = logSpy.mock.calls.map((call) => call[0]);
    expect(calls.some((call) => String(call).includes("Display Name"))).toBe(true);
    expect(calls.some((call) => String(call).includes("already added"))).toBe(true);
  });
});

describe("addConnectionCollections", () => {
  test("posts refs to the add endpoint", async () => {
    const summary = {
      added: [{ ref: "db-1", id: "5", displayName: "Blog Posts" }],
      alreadyAdded: [],
      scanned: 2,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(summary, 201));

    await addConnectionCollections("42", { format: "json", refs: ["db-1"] });

    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/v1/connections/42/add");
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ refs: ["db-1"] });
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(summary, null, 2));
  });

  test("posts all=true when requested", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ added: [], alreadyAdded: [], scanned: 0 }, 201));

    await addConnectionCollections("42", { format: "json", all: true });

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ all: true });
  });

  test("requires refs or --all", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    // oxlint-disable-next-line typescript-eslint/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(addConnectionCollections("42", { format: "table" })).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(
      "Usage: contfu connections add <connection-id> (--refs <comma-separated> | --all)",
    );

    exitSpy.mockRestore();
  });
});

describe("printAddSummary", () => {
  test("prints a human-readable summary", () => {
    printAddSummary({
      scanned: 3,
      added: [{ ref: "articles", id: "1", displayName: "Articles" }],
      alreadyAdded: [{ ref: "authors", displayName: "Authors", alreadyAdded: true }],
    });

    const calls = logSpy.mock.calls.map((call) => String(call[0]));
    expect(calls.some((call) => call.includes("Scanned 3 collections."))).toBe(true);
    expect(calls.some((call) => call.includes("Added 1 collection."))).toBe(true);
    expect(calls.some((call) => call.includes("Already added:"))).toBe(true);
  });
});
