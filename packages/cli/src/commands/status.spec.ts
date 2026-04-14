import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { status } from "./status";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as typeof fetch;

function jsonResponse(data: unknown, statusCode = 200): Response {
  return new Response(JSON.stringify(data), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

const CONNECTIONS = [
  {
    id: "1",
    name: "My Notion",
    type: 20,
    accountId: null,
    url: null,
    hasCredentials: true,
    includeRef: false,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
  {
    id: "2",
    name: "website",
    type: 0,
    accountId: null,
    url: null,
    hasCredentials: true,
    includeRef: false,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];
const COLLECTIONS = [
  {
    id: "1",
    name: "blog",
    displayName: "Blog Posts",
    flowSourceCount: 1,
    flowTargetCount: 0,
    schema: null,
    hasRef: false,
    refString: null,
    connectionId: null,
    connectionName: null,
    connectionType: null,
    includeRef: false,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];
const FLOWS = [
  {
    id: "1",
    sourceId: "10",
    targetId: "1",
    schema: null,
    mappings: null,
    filters: null,
    includeRef: false,
    createdAt: "2026-01-01",
    updatedAt: null,
  },
];

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

function mockApiResponses() {
  mockFetch.mockImplementation(((url: string) => {
    if (url.includes("/connections")) return Promise.resolve(jsonResponse(CONNECTIONS));
    if (url.includes("/collections")) return Promise.resolve(jsonResponse(COLLECTIONS));
    if (url.includes("/flows")) return Promise.resolve(jsonResponse(FLOWS));
    return Promise.resolve(jsonResponse({}, 404));
  }) as typeof fetch);
}

describe("status", () => {
  test("fetches and prints table summary", async () => {
    mockApiResponses();
    await status();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    const output = logSpy.mock.calls.map((c) => c[0]).join("\n");
    expect(output).toContain("contfu status");
    expect(output).toContain("Authenticated: yes");
    expect(output).toContain("My Notion");
    expect(output).toContain("notion");
    expect(output).toContain("Blog Posts");
    expect(output).toContain("1 flow(s)");
  });

  test("prints json when requested", async () => {
    mockApiResponses();
    await status("json");

    const output = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.authenticated).toBe(true);
    expect(parsed.connections).toHaveLength(2);
    expect(parsed.connections[0].typeLabel).toBe("notion");
    expect(parsed.connections[1].typeLabel).toBe("app");
    expect(parsed.collections).toHaveLength(1);
    expect(parsed.flows).toHaveLength(1);
  });

  test("shows not authenticated when no key", async () => {
    delete process.env.CONTFU_API_KEY;
    await status();
    expect(logSpy).toHaveBeenCalledWith(
      "Not authenticated. Run `contfu login` or set CONTFU_API_KEY.",
    );
  });

  test("shows not authenticated json when no key", async () => {
    delete process.env.CONTFU_API_KEY;
    await status("json");
    const parsed = JSON.parse(logSpy.mock.calls[0][0]);
    expect(parsed.authenticated).toBe(false);
  });
});
