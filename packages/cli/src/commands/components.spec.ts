import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { createComponentCommand, updateComponentCommand } from "./components";

const mockFetch = mock<typeof fetch>();
globalThis.fetch = mockFetch as unknown as typeof fetch;

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

let logSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  mockFetch.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
  logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("component dry run", () => {
  test("create resolves integration but does not POST", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([{ id: "int_1", name: "CMS" }]));

    await createComponentCommand("CMS", {
      name: "hero",
      displayName: "Hero",
      providerRef: "hero",
      dryRun: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect((mockFetch.mock.calls[0] as unknown[])[1]).toMatchObject({ method: "GET" });
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would create component",
    );
  });

  test("update does not PATCH", async () => {
    await updateComponentCommand("cmp_1", { displayName: "Hero", dryRun: true });

    expect(mockFetch).not.toHaveBeenCalled();
    expect(logSpy.mock.calls.map((c: unknown[]) => String(c[0])).join("\n")).toContain(
      "Dry run: would update component",
    );
  });
});
