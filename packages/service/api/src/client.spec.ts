import { beforeEach, describe, expect, test, mock } from "bun:test";
import { createApiClient, ApiError } from "./index";

const fetchMock = mock<typeof fetch>();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createApiClient", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  test("scanCollections calls the scan endpoint", async () => {
    const scanned = [{ ref: "articles", displayName: "Articles", alreadyAdded: false }];
    fetchMock.mockResolvedValueOnce(jsonResponse(scanned));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );
    const result = await client.scanCollections(42);

    expect(result).toEqual(scanned);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/connections/42/scan",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("addScannedCollections posts the request body to the add endpoint", async () => {
    const summary = {
      added: [{ ref: "articles", id: 7, displayName: "Articles" }],
      alreadyAdded: [],
      scanned: 2,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(summary, 201));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );
    const result = await client.addScannedCollections(42, { refs: ["articles"] });

    expect(result).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/connections/42/add",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refs: ["articles"] }),
      }),
    );
  });

  test("throws ApiError with server message on non-ok responses", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Unknown refs: missing" }, 400));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );

    // oxlint-disable-next-line typescript-eslint/await-thenable -- bun:test .rejects returns a Promise at runtime but types lack Thenable
    await expect(client.addScannedCollections(42, { refs: ["missing"] })).rejects.toEqual(
      new ApiError(400, "Unknown refs: missing"),
    );
  });
});
