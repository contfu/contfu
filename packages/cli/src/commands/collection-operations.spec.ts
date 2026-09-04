import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import { runCollectionOperation } from "./collection-operations";

const fetchMock = mock<typeof fetch>();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const collection = { id: "col_1", name: "articles", displayName: "Articles" };

beforeEach(() => {
  fetchMock.mockReset();
  process.env.CONTFU_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.CONTFU_API_KEY;
});

describe("collection source operation commands", () => {
  test("non-waiting source operations succeed while running", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([collection]))
      .mockResolvedValueOnce(
        jsonResponse({ id: "op_1", operation: 1, status: 1, collectionId: "col_1" }),
      );

    await runCollectionOperation("sync-now", "articles", { format: "json" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("waits for full resync repair jobs to reach a terminal status", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse([collection]))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job_1", status: "waiting-prerequisites" }))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job_1", status: "running" }))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job_1", status: "completed" }));

    await runCollectionOperation("full-resync", "articles", { format: "json", wait: true });

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[2][0]).toContain("/full-resync/job_1");
  });

  test("dry run resolves the collection without starting an operation", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(jsonResponse([collection]));

    try {
      await runCollectionOperation("full-refresh", "articles", {
        format: "json",
        dryRun: true,
      });
    } finally {
      logSpy.mockRestore();
    }

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
