import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { apiFetch } from "./http";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as typeof fetch;

let errorSpy: ReturnType<typeof spyOn>;
let exitSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  process.env.CONTFU_URL = "http://test.local";
  errorSpy = spyOn(console, "error").mockImplementation(() => {});
  exitSpy = spyOn(process, "exit").mockImplementation(() => {
    throw new Error("exit");
  });
});

afterEach(() => {
  errorSpy.mockRestore();
  exitSpy.mockRestore();
});

describe("apiFetch", () => {
  test("prints quota messages from 403 JSON responses", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "collections quota exceeded" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      }),
    );

    try {
      await apiFetch("/api/v1/collections", { method: "POST" });
      throw new Error("Expected apiFetch to exit");
    } catch (error) {
      expect((error as Error).message).toBe("exit");
    }

    expect(errorSpy).toHaveBeenCalledWith("collections quota exceeded");
  });

  test("keeps the scope message for permission-related 403 responses", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Insufficient permissions", { status: 403 }));

    try {
      await apiFetch("/api/v1/collections", { method: "POST" });
      throw new Error("Expected apiFetch to exit");
    } catch (error) {
      expect((error as Error).message).toBe("exit");
    }

    expect(errorSpy).toHaveBeenCalledWith(
      "Insufficient permissions. Your API key does not have the required scope for this action.",
    );
  });
});
