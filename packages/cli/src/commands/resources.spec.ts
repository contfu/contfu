import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { list, get, create, update, del, isResource, listConnectionTypes } from "./resources";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as any;

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

describe("isResource", () => {
  test("returns true for valid resources", () => {
    expect(isResource("connections")).toBe(true);
    expect(isResource("collections")).toBe(true);
    expect(isResource("flows")).toBe(true);
  });

  test("returns false for invalid resources", () => {
    expect(isResource("bogus")).toBe(false);
    expect(isResource("")).toBe(false);
    expect(isResource("sources")).toBe(false);
    expect(isResource("consumers")).toBe(false);
  });
});

describe("list", () => {
  test("fetches and prints resource list", async () => {
    const data = [{ id: 1, name: "test" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("connections", "json");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("lists collections in table format with headers and row data", async () => {
    const data = [{ id: 5, name: "posts", displayName: "Posts", connectionId: 1 }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("collections", "table");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections");
    const calls = logSpy.mock.calls.map((c) => (c as unknown[])[0] as string);
    expect(calls.some((c) => c.includes("Display Name"))).toBe(true);
    expect(calls.some((c) => c.includes("Posts"))).toBe(true);
  });

  test("lists flows in table format showing yes for includeRef", async () => {
    const data = [{ id: 3, sourceId: 1, targetId: 2, includeRef: true }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("flows", "table");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/flows");
    const calls = logSpy.mock.calls.map((c) => (c as unknown[])[0] as string);
    expect(calls.some((c) => c.includes("yes"))).toBe(true);
  });
});

describe("get", () => {
  test("fetches and prints single resource", async () => {
    const data = { id: 1, name: "test" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("connections", "1");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("fetches collection by id", async () => {
    const data = { id: 5, displayName: "Posts" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("collections", "5");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/collections/5");
  });

  test("fetches flow by id", async () => {
    const data = { id: 7, sourceId: 1, targetId: 2 };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("flows", "7");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/flows/7");
  });
});

describe("create", () => {
  test("posts with raw json data", async () => {
    const data = { id: 1, name: "new" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("connections", '{"label":"new"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(opts.method).toBe("POST");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("posts with field flags", async () => {
    const data = { id: 2, label: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("connections", undefined, { name: "flagged" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "flagged", type: 20 });
  });

  test("exits with error when required flags missing", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    // oxlint-disable-next-line typescript/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(create("collections", undefined, {})).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--display-name"));
    exitSpy.mockRestore();
  });

  test("creates collection with displayName from --display-name", async () => {
    const data = { id: 5, displayName: "My Col" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("collections", undefined, { "display-name": "My Col" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections");
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "My Col" });
  });

  test("creates flow with sourceId/targetId as strings", async () => {
    const data = { id: "1", sourceId: "3", targetId: "4" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", undefined, { "source-id": "3", "target-id": "4" });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    const body = JSON.parse(opts.body as string);
    expect(body.sourceId).toBe("3");
    expect(body.targetId).toBe("4");
    expect(typeof body.sourceId).toBe("string");
    expect(typeof body.targetId).toBe("string");
  });

  test("creates flow with includeRef: true when --include-ref", async () => {
    const data = { id: 1, sourceId: 3, targetId: 4, includeRef: true };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("flows", undefined, { "source-id": "3", "target-id": "4", "include-ref": true });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({ includeRef: true });
  });

  test("creates collection with includeRef: false when --no-include-ref", async () => {
    const data = { id: 5, displayName: "Col" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("collections", undefined, {
      "display-name": "Col",
      "no-include-ref": true,
    });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({ includeRef: false });
  });
});

describe("update", () => {
  test("updates collection with displayName", async () => {
    const data = { id: 5, displayName: "Renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("collections", "5", undefined, { "display-name": "Renamed" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/collections/5");
    expect(JSON.parse(opts.body as string)).toMatchObject({ displayName: "Renamed" });
  });

  test("updates flow with includeRef: true", async () => {
    const data = { id: 7, includeRef: true };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("flows", "7", undefined, { "include-ref": true });

    const [, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(JSON.parse(opts.body as string)).toMatchObject({ includeRef: true });
  });

  test("patches with raw json data", async () => {
    const data = { id: 1, name: "updated" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("connections", "1", '{"label":"updated"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(opts.method).toBe("PATCH");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("patches with field flags", async () => {
    const data = { id: 1, label: "renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("connections", "1", undefined, { name: "renamed" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "renamed" });
  });
});

describe("del", () => {
  test("deletes and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("connections", "42");

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/connections/42");
    expect(opts.method).toBe("DELETE");
    expect(logSpy).toHaveBeenCalledWith("Deleted connection 42");
  });

  test("deletes collection and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("collections", "5");

    expect(logSpy).toHaveBeenCalledWith("Deleted collection 5");
  });

  test("deletes flow and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("flows", "12");

    expect(logSpy).toHaveBeenCalledWith("Deleted flow 12");
  });
});

describe("listConnectionTypes", () => {
  test("writes connection type groups separated by blank line", () => {
    const writeSpy = spyOn(process.stdout, "write").mockImplementation(() => true);

    listConnectionTypes();

    const written = (writeSpy.mock.calls as unknown[][]).map((c) => c[0] as string).join("");
    writeSpy.mockRestore();
    // custom types (app, web) come before services (contentful, notion, strapi)
    expect(written).toContain("app");
    expect(written).toContain("notion");
    expect(written).toContain("strapi");
    // blank line separator between groups
    expect(written).toContain("\n\n");
  });
});
