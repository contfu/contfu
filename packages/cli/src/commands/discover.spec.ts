import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from "bun:test";
import { discover } from "./discover";

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

describe("discover", () => {
  test("prints discovered collections as JSON", async () => {
    const collections = [
      { ref: "db-1", displayName: "Blog Posts", alreadyImported: false },
      { ref: "db-2", displayName: "Authors", alreadyImported: true },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(collections));

    await discover("42");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("/api/v1/connections/42/discover");
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(collections, null, 2));
  });

  test("handles API errors", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ message: "Not found" }, 404));

    const exitSpy = spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit");
    });

    try {
      await discover("999");
      expect.unreachable("should have thrown");
    } catch {
      expect(errorSpy).toHaveBeenCalled();
    }

    exitSpy.mockRestore();
  });
});
