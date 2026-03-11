import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { status } from "./status";

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

describe("status", () => {
  test("fetches and prints status summary", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        connections: 4,
        collections: 2,
        flows: 3,
      }),
    );

    await status();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = (mockFetch.mock.calls[0] as unknown[])[0] as string;
    expect(url).toBe("http://test.local/api/v1/status");
    expect(logSpy).toHaveBeenNthCalledWith(1, "contfu status");
    expect(logSpy).toHaveBeenNthCalledWith(2, "-------------");
    expect(logSpy).toHaveBeenNthCalledWith(3, "connections  4");
    expect(logSpy).toHaveBeenNthCalledWith(4, "collections  2");
    expect(logSpy).toHaveBeenNthCalledWith(5, "flows        3");
  });

  test("prints json when requested", async () => {
    const data = {
      connections: 4,
      collections: 2,
      flows: 3,
    };
    mockFetch.mockResolvedValueOnce(jsonResponse(data));

    await status("json");

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
  });
});
