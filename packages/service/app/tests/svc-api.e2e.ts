/**
 * E2E tests for @contfu/svc-api — the typed service API client.
 *
 * Tests the full CRUD lifecycle for connections, collections, and flows
 * using the real createApiClient against the live service instance.
 *
 * Bootstrap: the test uses a pre-seeded API key (injected by seed-and-serve.ts)
 * to create the typed API client.
 */
import { expect, test, type Page } from "@playwright/test";
import { createApiClient, ConnectionType, type ContfuApiClient } from "@contfu/svc-api";

const SERVICE_URL = `http://localhost:${process.env.PORT ?? 4173}`;
const TEST_USER = { email: "test@test.com", password: "test" };
// This key is seeded by tests/seed-and-serve.ts at test startup.
const SEEDED_API_KEY = "e2e-test-api-key-contfu-000000000001";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/login")) return;
  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login|Authenticate/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe("@contfu/svc-api client", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let client: ContfuApiClient;
  let createdConnectionId: number | undefined;
  let createdCollectionId: string | undefined;
  let createdFlowId: number | undefined;
  let targetCollectionId: string | undefined;

  test("setup: initialize client with seeded API key", async ({ page }) => {
    await login(page);
    client = createApiClient(SERVICE_URL, SEEDED_API_KEY);
  });

  test("getStatus returns connection/collection/flow counts", async () => {
    const status = await client.getStatus();
    expect(typeof status.connections).toBe("number");
    expect(typeof status.collections).toBe("number");
    expect(typeof status.flows).toBe("number");
  });

  test("listConnections returns array", async () => {
    const connections = await client.listConnections();
    expect(Array.isArray(connections)).toBe(true);
  });

  test("createConnection creates a WEB connection", async () => {
    const conn = await client.createConnection({
      name: "E2E Web Connection",
      type: ConnectionType.WEB,
      url: "https://example.com",
    });
    expect(conn.name).toBe("E2E Web Connection");
    expect(conn.type).toBe(ConnectionType.WEB);
    expect(typeof conn.id).toBe("number");
    createdConnectionId = conn.id;
  });

  test("getConnection returns the created connection", async () => {
    const conn = await client.getConnection(createdConnectionId!);
    expect(conn.id).toBe(createdConnectionId);
    expect(conn.name).toBe("E2E Web Connection");
  });

  test("updateConnection updates the connection name", async () => {
    const updated = await client.updateConnection(createdConnectionId!, {
      name: "E2E Web Connection Updated",
    });
    expect(updated.name).toBe("E2E Web Connection Updated");
  });

  test("createCollection creates a collection", async () => {
    const col = await client.createCollection({ displayName: "E2E Collection" });
    expect(col.displayName).toBe("E2E Collection");
    createdCollectionId = String(col.id);
  });

  test("getCollection returns the created collection", async () => {
    const col = await client.getCollection(createdCollectionId!);
    expect(col.displayName).toBe("E2E Collection");
  });

  test("getConnectionTypes returns TypeGenerationInput array for WEB connection", async () => {
    const types = await client.getConnectionTypes(createdConnectionId!);
    expect(Array.isArray(types)).toBe(true);
  });

  test("createFlow creates a flow between two collections", async ({ page }) => {
    // Create a CLIENT connection via UI then bind target collection to it
    await login(page);
    // First create a CLIENT connection via the connections/new UI
    await page.goto("/connections/new");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: /client/i }).click();
    await page.locator('input[placeholder="My App"]').fill("SVC-API E2E Target Client");
    await page.getByRole("button", { name: /create client/i }).click();
    await page.waitForURL(/\/connections\/[^/]+$/, { timeout: 15000 });
    // Extract connection ID from URL
    const connectionUrl = page.url();
    const encodedId = connectionUrl.match(/\/connections\/([^/]+)$/)![1];
    const connections = await client.listConnections();
    // Find the newly created CLIENT connection by encoded ID
    // We use the name to identify it
    const clientConn = connections.find(
      (c) => c.type === ConnectionType.CLIENT && c.name === "SVC-API E2E Target Client",
    );
    expect(clientConn).toBeDefined();
    void encodedId; // used for navigation, actual ID from API
    const targetConnectionId = clientConn!.id;

    const targetCol = await client.createCollection({
      displayName: "E2E Target Collection",
      connectionId: targetConnectionId,
    });
    targetCollectionId = String(targetCol.id);

    const flow = await client.createFlow({
      sourceId: Number(createdCollectionId!),
      targetId: Number(targetCollectionId),
    });
    expect(flow.id).toBeDefined();
    expect(flow.includeRef).toBe(true);
    createdFlowId = Number(flow.id);
  });

  test("listFlows returns array containing the created flow", async () => {
    const flows = await client.listFlows();
    expect(Array.isArray(flows)).toBe(true);
    expect(flows.some((f) => Number(f.id) === createdFlowId)).toBe(true);
  });

  test("getFlow returns flow with details", async () => {
    const flow = await client.getFlow(createdFlowId!);
    expect(Number(flow.id)).toBe(createdFlowId);
    expect(typeof flow.sourceCollectionName).toBe("string");
    expect(typeof flow.targetCollectionName).toBe("string");
  });

  test("updateFlow updates includeRef", async () => {
    const updated = await client.updateFlow(createdFlowId!, { includeRef: true });
    expect(updated.includeRef).toBe(true);
  });

  test.afterAll(async () => {
    if (createdFlowId) await client.deleteFlow(createdFlowId);
    if (targetCollectionId) await client.deleteCollection(targetCollectionId);
    if (createdCollectionId) await client.deleteCollection(createdCollectionId);
    if (createdConnectionId) await client.deleteConnection(createdConnectionId);
  });
});
