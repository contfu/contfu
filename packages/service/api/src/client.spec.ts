import { beforeEach, describe, expect, test, mock } from "bun:test";
import { createApiClient, ApiError } from "./index";

const fetchMock = mock<typeof fetch>();

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(data: string, status = 200): Response {
  return new Response(data, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
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
    const result = await client.scanCollections("42");

    expect(result).toEqual(scanned);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/integrations/42/scan",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("getCollectionTypes returns text responses and passes workspace context", async () => {
    const generatedTypes = "export type Pages = { id: number };\n";
    fetchMock.mockResolvedValueOnce(textResponse(generatedTypes));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
      "ws_42",
    );
    const result = await client.getCollectionTypes("42");

    expect(result).toBe(generatedTypes);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/collections/42/types?workspace=ws_42",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("addScannedCollections posts the request body to the add endpoint", async () => {
    const summary = {
      added: [{ ref: "articles", id: "7", displayName: "Articles" }],
      alreadyAdded: [],
      scanned: 2,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(summary, 201));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );
    const result = await client.addScannedCollections("42", { refs: ["articles"] });

    expect(result).toEqual(summary);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/integrations/42/add",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refs: ["articles"] }),
      }),
    );
  });

  test("lists target failed deliveries through the target-delivery endpoint", async () => {
    const deliveries = [
      {
        id: "td_1",
        workspaceId: "ws_1",
        collectionId: "col_1",
        itemId: 42,
        attempts: 3,
        lastError: "HTTP 500",
        lastAttemptAt: "2026-06-20T00:00:00.000Z",
      },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse(deliveries));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );
    const result = await client.listTargetFailedDeliveries({ integrationId: "int_1" });

    expect(result).toEqual(deliveries);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/target-deliveries/failed?integration=int_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("redelivers target failed deliveries through the target-delivery endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ accepted: 1 }));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );
    const result = await client.redeliverTargetFailedDelivery("td_1");

    expect(result).toEqual({ accepted: 1 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/target-deliveries/failed/td_1",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ action: "redeliver" }),
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
    await expect(client.addScannedCollections("42", { refs: ["missing"] })).rejects.toEqual(
      new ApiError(400, "Unknown refs: missing"),
    );
  });
});
