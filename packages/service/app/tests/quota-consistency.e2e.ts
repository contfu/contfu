/**
 * E2E tests for quota consistency.
 *
 * Verifies that the quota cache stays consistent when collections (and their
 * cascade-deleted flows) are removed.
 */
import { expect, test, type Page } from "@playwright/test";
import { createApiClient, type ContfuApiClient } from "@contfu/svc-api";

const SERVICE_URL = `http://localhost:${process.env.PORT ?? 4173}`;
const TEST_USER = { email: "test@test.com", password: "test" };
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

test.describe("quota consistency", () => {
  test.describe.configure({ mode: "serial", timeout: 60000 });

  let client: ContfuApiClient;
  let sourceCollectionId: number | undefined;
  let targetCollectionId: number | undefined;
  let flowId: number | undefined;

  test("setup: initialize client with seeded API key", async ({ page }) => {
    await login(page);
    client = createApiClient(SERVICE_URL, SEEDED_API_KEY);
  });

  test("deleting a collection decrements the flow quota by the number of cascade-deleted flows", async () => {
    const before = await client.getStatus();

    const source = await client.createCollection({ displayName: "Quota Test Source" });
    sourceCollectionId = source.id;
    const target = await client.createCollection({ displayName: "Quota Test Target" });
    targetCollectionId = target.id;

    const flow = await client.createFlow({
      sourceId: sourceCollectionId,
      targetId: targetCollectionId,
    });
    flowId = Number(flow.id);

    const afterCreate = await client.getStatus();
    expect(afterCreate.collections).toBe(before.collections + 2);
    expect(afterCreate.flows).toBe(before.flows + 1);

    // Deleting the source collection should cascade-delete the flow and
    // decrement both collection and flow quota counts.
    await client.deleteCollection(String(sourceCollectionId));
    sourceCollectionId = undefined;
    flowId = undefined;

    const afterDelete = await client.getStatus();
    expect(afterDelete.collections).toBe(before.collections + 1);
    expect(afterDelete.flows).toBe(before.flows);
  });

  test.afterAll(async () => {
    if (flowId) await client.deleteFlow(flowId);
    if (sourceCollectionId) await client.deleteCollection(String(sourceCollectionId));
    if (targetCollectionId) await client.deleteCollection(String(targetCollectionId));
  });
});
