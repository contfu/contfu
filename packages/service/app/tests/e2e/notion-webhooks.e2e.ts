import { test, expect } from "../fixtures";
import crypto from "node:crypto";

// Must match the mock-notion-server.ts constants
const MOCK_PAGE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const MOCK_DATABASE_ID = "11111111-2222-3333-4444-555555555555";

function computeHmacSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return hmac.digest("hex");
}

interface SeedData {
  sourceUid: string;
  consumerKey: string;
  collectionId: number;
  sourceCollectionId: number;
}

let seedData: SeedData;
let baseURL: string;
let webhookSecret: string;

test.describe("Notion Webhooks", () => {
  test.beforeAll(async ({ browser }) => {
    // Login to create test user, then seed webhook test data
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/login");
    await page.waitForLoadState("domcontentloaded");
    await page.fill('input[name="email"], input[type="email"]', "test@test.com");
    await page.fill('input[name="password"], input[type="password"]', "test");
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle" }),
      page.click('button[type="submit"]'),
    ]);

    baseURL = page
      .url()
      .replace(/\/[^/]*$/, "")
      .replace(/\/dashboard$/, "");

    // Seed webhook test pipeline
    const seedResponse = await page.request.post(`${baseURL}/api/test/webhook-seed`);
    expect(seedResponse.ok()).toBe(true);
    seedData = await seedResponse.json();
    expect(seedData.sourceUid).toBe("test-notion-webhook-uid");

    await context.close();
  });

  test("verification flow stores token and logs success", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test-webhook-secret" });
    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(200);

    // Store the secret for later HMAC signing
    webhookSecret = "test-webhook-secret";

    // Verify log entry
    const logsResponse = await request.get(
      `/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`,
    );
    const logs = await logsResponse.json();
    const verificationLog = logs.find((l: { event: string }) => l.event === "verification");
    expect(verificationLog).toBeTruthy();
    expect(verificationLog.status).toBe("success");
  });

  test("returns 404 for nonexistent source uid", async ({ request }) => {
    const body = JSON.stringify({ verification_token: "test" });
    const response = await request.post("/webhooks/notion/nonexistent-uid", {
      data: body,
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(404);
  });

  test("page.created fetches page and broadcasts", async ({ request }) => {
    const payload = {
      type: "page.created",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);

    // Verify log entry
    const logsResponse = await request.get(
      `/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`,
    );
    const logs = await logsResponse.json();
    const createdLog = logs.find((l: { event: string }) => l.event === "page.created");
    expect(createdLog).toBeTruthy();
    expect(createdLog.status).toBe("success");
    expect(createdLog.itemsBroadcast).toBeGreaterThanOrEqual(1);
  });

  test("page.deleted broadcasts deletion", async ({ request }) => {
    const payload = {
      type: "page.deleted",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);

    // Verify log entry
    const logsResponse = await request.get(
      `/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`,
    );
    const logs = await logsResponse.json();
    const deletedLog = logs.find((l: { event: string }) => l.event === "page.deleted");
    expect(deletedLog).toBeTruthy();
    expect(deletedLog.status).toBe("success");
  });

  test("rejects invalid HMAC signature with 401", async ({ request }) => {
    const payload = {
      type: "page.created",
      entity: { id: MOCK_PAGE_ID, type: "page" },
      data: {
        parent: { type: "database_id", database_id: MOCK_DATABASE_ID },
      },
    };
    const body = JSON.stringify(payload);
    const badSignature = computeHmacSignature(body, "wrong-secret");

    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": badSignature,
      },
    });

    expect(response.status()).toBe(401);

    // Verify unauthorized log entry
    const logsResponse = await request.get(
      `/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`,
    );
    const logs = await logsResponse.json();
    const unauthorizedLog = logs.find((l: { status: string }) => l.status === "unauthorized");
    expect(unauthorizedLog).toBeTruthy();
  });

  test("page.locked is ignored (no log entry)", async ({ request }) => {
    const payload = {
      type: "page.locked",
      entity: { id: MOCK_PAGE_ID, type: "page" },
    };
    const body = JSON.stringify(payload);
    const signature = computeHmacSignature(body, webhookSecret);

    // Get current log count
    const beforeLogs = await request.get(`/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`);
    const beforeCount = (await beforeLogs.json()).length;

    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: body,
      headers: {
        "Content-Type": "application/json",
        "X-Notion-Signature": signature,
      },
    });

    expect(response.status()).toBe(200);

    // Log count should be same (page.locked is a no-op, no log)
    const afterLogs = await request.get(`/api/test/webhook-logs?sourceUid=${seedData.sourceUid}`);
    const afterCount = (await afterLogs.json()).length;
    expect(afterCount).toBe(beforeCount);
  });

  test("returns 400 for invalid JSON", async ({ request }) => {
    const response = await request.post(`/webhooks/notion/${seedData.sourceUid}`, {
      data: Buffer.from("{invalid json"),
      headers: { "Content-Type": "application/json" },
    });

    expect(response.status()).toBe(400);
  });
});
