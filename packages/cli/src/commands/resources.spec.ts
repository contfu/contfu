import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { list, get, create, update, del, isResource } from "./resources";

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
    expect(isResource("sources")).toBe(true);
    expect(isResource("collections")).toBe(true);
    expect(isResource("consumers")).toBe(true);
    expect(isResource("connections")).toBe(true);
    expect(isResource("influxes")).toBe(true);
  });

  test("returns false for invalid resources", () => {
    expect(isResource("bogus")).toBe(false);
    expect(isResource("")).toBe(false);
  });
});

describe("list", () => {
  test("fetches and prints resource list", async () => {
    const data = [{ id: 1, name: "test" }];
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await list("sources", "json");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/sources");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
});

describe("get", () => {
  test("fetches and prints single resource", async () => {
    const data = { id: 1, name: "test" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await get("sources", "1");

    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/sources/1");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
});

describe("create", () => {
  test("posts with raw json data", async () => {
    const data = { id: 1, name: "new" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("sources", '{"name":"new","type":1}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/sources");
    expect(opts.method).toBe("POST");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("posts with field flags", async () => {
    const data = { id: 2, name: "flagged" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await create("sources", undefined, { name: "flagged", type: "notion" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/sources");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "flagged", type: 0 });
  });

  test("exits with error when required flags missing", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });
    await expect(create("sources", undefined, { name: "only-name" })).rejects.toThrow("exit");
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("--type"));
    exitSpy.mockRestore();
  });
});

describe("update", () => {
  test("patches with raw json data", async () => {
    const data = { id: 1, name: "updated" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("sources", "1", '{"name":"updated"}', {});

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/sources/1");
    expect(opts.method).toBe("PATCH");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });

  test("patches with field flags", async () => {
    const data = { id: 1, name: "renamed" };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await update("sources", "1", undefined, { name: "renamed" });

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/sources/1");
    expect(opts.method).toBe("PATCH");
    expect(JSON.parse(opts.body as string)).toEqual({ name: "renamed" });
  });
});

describe("del", () => {
  test("deletes and prints confirmation", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));

    await del("sources", "42");

    const [url, opts] = mockFetch.mock.calls[0] as unknown[] as [string, RequestInit];
    expect(url).toBe("http://test.local/api/v1/sources/42");
    expect(opts.method).toBe("DELETE");
    expect(logSpy).toHaveBeenCalledWith("Deleted source 42");
  });
});
