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

  test("source operation methods use workspace-scoped collection endpoints", async () => {
    const operation = { id: "op_1", status: 2, operation: 1 };
    fetchMock
      .mockResolvedValueOnce(jsonResponse(operation))
      .mockResolvedValueOnce(jsonResponse(operation))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job_1", status: "completed" }))
      .mockResolvedValueOnce(jsonResponse({ jobId: "job_1", status: "completed" }))
      .mockResolvedValueOnce(jsonResponse({ success: true }))
      .mockResolvedValueOnce(jsonResponse({ enqueued: 1 }))
      .mockResolvedValueOnce(jsonResponse([operation]))
      .mockResolvedValueOnce(jsonResponse(operation));
    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
      "ws_42",
    );

    await client.syncCollectionNow("col_1");
    await client.fullRefreshCollection("col_1");
    await client.fullResyncCollection("col_1", { refreshSourceFirst: true });
    await client.getFullResyncStatus("col_1", "job_1");
    await client.pauseCollection("col_1");
    await client.resumeCollection("col_1");
    await client.listCollectionOperations("col_1");
    await client.getSourceOperation("op_1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "http://test.local/api/v1/collections/col_1/sync-now?workspace=ws_42",
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "http://test.local/api/v1/collections/col_1/full-resync?workspace=ws_42",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshSourceDataFirst: true }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      "http://test.local/api/v1/collections/col_1/full-resync/job_1?workspace=ws_42",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      7,
      "http://test.local/api/v1/collections/col_1/operations?workspace=ws_42",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      8,
      "http://test.local/api/v1/source-operations/op_1?workspace=ws_42",
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

  test("lists incidents with workspace and resource filters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
      "ws_1",
    );

    expect(
      await client.listIncidents({
        collectionId: "col_1",
        flowId: "flow_1",
        resolved: "all",
      }),
    ).toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/incidents?collection=col_1&flow=flow_1&resolved=all&workspace=ws_1",
      expect.objectContaining({ method: "GET" }),
    );
  });

  test("dismisses an incident through the mutation endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ dismissed: 2 }));
    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
    );

    expect(await client.dismissIncident("inc_1")).toEqual({ dismissed: 2 });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/incidents/inc_1/dismiss",
      expect.objectContaining({ method: "POST" }),
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

  test("gets organization usage through the unscoped endpoint", async () => {
    const usage = {
      organization: { id: "org_1", name: "acme", displayName: "Acme" },
      metrics: {
        integrations: { used: 1, limit: 10 },
        collections: { used: 2, limit: null },
        flows: { used: 3, limit: 10 },
        items: { used: 4, limit: 100 },
        itemChanges: { used: 5, limit: 100 },
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(usage));

    const client = createApiClient(
      "http://test.local",
      "api-key",
      fetchMock as unknown as typeof fetch,
      "workspace-that-must-not-leak",
    );
    const result = await client.getOrganizationUsage("org_1");
    expect(result).toEqual(usage);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://test.local/api/v1/organizations/org_1/usage",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
