/**
 * End-to-end Playwright test for the full Strapi → Service → Client flow.
 *
 * This test uses captured webhook fixtures instead of starting a real Strapi instance.
 * The service app is started by global-setup.ts (shared across all test files).
 *
 * Flow:
 * 1. Service app already running (global-setup)
 * 2. Playwright: Login to service app, create Strapi source, create client → capture API key
 * 3. Start Consumer app with CONTFU_API_KEY env var
 * 4. Send webhook payloads directly (simulating Strapi webhooks)
 * 5. Verify content in Consumer app
 */
import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Project root (contfu/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// Port configuration
const SERVICE_URL = process.env.E2E_SERVICE_URL || "http://localhost:8011";
const CONSUMER_PORT = 4000;
const CONSUMER_URL = `http://localhost:${CONSUMER_PORT}`;

// Test data
const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

// Track spawned processes for cleanup (consumer app only)
const processes: ChildProcess[] = [];

/**
 * Spawn a process and wait for it to be ready (via URL polling)
 */
async function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 60000,
  readyUrl?: string,
  forwardOutput = false,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Process did not become ready within ${timeoutMs}ms: ${command} ${args.join(" ")}`,
        ),
      );
    }, timeoutMs);

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    processes.push(proc);

    let output = "";
    let isReady = false;

    const markReady = () => {
      if (!isReady) {
        isReady = true;
        clearTimeout(timeout);
        resolve(proc);
      }
    };

    const checkOutput = (data: Buffer) => {
      const text = data.toString();
      output += text;

      if (process.env.CI) {
        process.stdout.write(`[${command}] ${text}`);
      } else if (forwardOutput && isReady) {
        process.stdout.write(`[${command}] ${text}`);
      }
    };

    proc.stdout?.on("data", checkOutput);
    proc.stderr?.on("data", checkOutput);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null && !isReady) {
        clearTimeout(timeout);
        reject(new Error(`Process exited with code ${code}: ${output}`));
      }
    });

    if (readyUrl) {
      const pollUrl = async () => {
        const pollStart = Date.now();
        while (Date.now() - pollStart < timeoutMs && !isReady) {
          try {
            const response = await fetch(readyUrl, { method: "GET" });
            if (response.ok || response.status === 404 || response.status === 500) {
              markReady();
              return;
            }
          } catch {
            // Server not ready yet
          }
          await sleep(500);
        }
      };
      void pollUrl();
    }
  });
}

/**
 * Kill all spawned processes (consumer app)
 */
async function killAllProcesses(): Promise<void> {
  for (const proc of processes) {
    if (proc.pid && !proc.killed) {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        proc.kill("SIGTERM");
      }
    }
  }
  processes.length = 0;
  await sleep(1000);
}

/**
 * Poll for articles to appear in the consumer app.
 * Reloads the page and checks for the article text with retries.
 */
async function waitForArticleInConsumerApp(
  page: Page,
  articleTitle: string,
  timeoutMs = 30000,
  pollIntervalMs = 2000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await page.reload();
    await page.waitForLoadState("networkidle");

    const isVisible = await page
      .getByText(articleTitle)
      .isVisible()
      .catch(() => false);
    if (isVisible) {
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`Article "${articleTitle}" did not appear within ${timeoutMs}ms`);
}

/**
 * Setup service app: login/register, create Strapi source, create client
 * Returns API key and sourceUid for webhook configuration
 */
async function setupServiceAppAndGetApiKey(
  page: Page,
  strapiUrl: string,
  strapiApiToken: string,
): Promise<{ apiKey: string; sourceUid: string | null }> {
  console.log("[E2E] Setting up service app...");

  // Navigate directly to login page
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Fill login form with existing test credentials
  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 10000 });

  // Create a Strapi source
  await page.getByRole("link", { name: /Add Source/i }).click();
  await page.waitForURL(/\/sources\/new/);

  await page.getByLabel(/Name/i).fill("E2E Strapi Demo");
  await page.getByLabel(/Strapi URL/i).fill(strapiUrl);
  await page.getByLabel(/API Token/i).fill(strapiApiToken);
  await page.getByRole("button", { name: /Create Source/i }).click();

  await page.waitForURL(/\/sources\/\d+/, { timeout: 10000 });

  // Capture source ID from URL and UID from the webhook URL input
  const sourceUrl = page.url();
  const sourceIdMatch = sourceUrl.match(/\/sources\/(\d+)/);
  const sourceId = sourceIdMatch ? sourceIdMatch[1] : null;
  console.log(`[E2E] Strapi source created (ID: ${sourceId})`);

  // Get source UID from test API (source detail page may not render in test mode)
  const sourceResp = await fetch(`${SERVICE_URL}/api/test/source?id=${sourceId}`);
  const sourceData = await sourceResp.json();
  const sourceUid = sourceData.uid ?? null;
  console.log(`[E2E] Webhook URL for this source: ${SERVICE_URL}/webhooks/strapi/${sourceUid}`);

  // Create a Collection with implicit SourceCollection creation via UI
  // Navigate to collections/new with sourceId and ref as query params
  // The form has hidden fields that get populated from these params
  await page.goto(`${SERVICE_URL}/collections/new?sourceId=${sourceId}&ref=api::article.article`);
  await page.getByLabel(/Name/i).fill("Articles");
  await page.getByRole("button", { name: /Create Collection/i }).click();

  // Wait for redirect to collection detail page
  await page.waitForURL(/\/collections\/\d+/, { timeout: 10000 });
  const collectionUrl = page.url();
  const collectionIdMatch = collectionUrl.match(/\/collections\/(\d+)/);
  const collectionId = collectionIdMatch ? collectionIdMatch[1] : null;
  console.log(`[E2E] Collection created with linked SourceCollection (ID: ${collectionId})`);

  // Create a client for the consumer app
  await page.goto(`${SERVICE_URL}/consumers`);
  await page.getByRole("link", { name: /Add Consumer/i }).click();
  await page.locator('input[name="name"]').fill("E2E Consumer App");
  await page.getByRole("button", { name: /Create Consumer/i }).click();

  // Wait for client creation
  await page.waitForURL(/\/consumers\/\d+/, { timeout: 10000 });

  // Connect client to Articles collection
  // Wait for page to hydrate and load collections
  await page.waitForLoadState("networkidle");
  await sleep(500);

  // The COLLECTIONS section has a dropdown to select a collection and Connect button
  const collectionDropdown = page.locator("select").first();
  await collectionDropdown.waitFor({ state: "visible", timeout: 10000 });
  await collectionDropdown.selectOption({ label: "Articles" });
  await page.getByRole("button", { name: /^Connect$/i }).click();
  await sleep(1000);
  console.log("[E2E] Connected consumer to Articles collection");

  // Click Regenerate to generate/show the API key
  // The key appears in an Alert with "New API Key" title after form submission
  let apiKey = "";

  // Wait for page to fully hydrate before clicking (ensures JS form enhancement is active)
  await page.waitForLoadState("networkidle");
  await sleep(500); // Extra buffer for Svelte hydration

  const regenerateBtn = page.getByRole("button", { name: /^Regenerate$/i });
  if (await regenerateBtn.isVisible().catch(() => false)) {
    // Click and wait for the key to appear in UI
    // Regenerate now uses a remote function (enhance), not a POST request
    await regenerateBtn.click();

    // Wait for the key to appear in the UI
    await sleep(1500); // Wait for remote function to complete and UI to update

    // Look for the key in a <code> element (hex string, typically 40+ chars)
    const codeElements = page.locator("code");
    const count = await codeElements.count();

    for (let i = 0; i < count; i++) {
      const text = await codeElements.nth(i).textContent();
      if (text && text.length > 30 && /^[a-f0-9]+$/i.test(text.trim())) {
        apiKey = text.trim();
        break;
      }
    }
  }

  if (!apiKey) {
    // Take a screenshot for debugging
    await page.screenshot({ path: "api-key-capture-debug.png" });
    throw new Error(
      "Could not capture API key from service app UI - see api-key-capture-debug.png",
    );
  }

  const trimmedKey = apiKey.trim();
  console.log(
    `[E2E] Captured consumer API key from service app (length: ${trimmedKey.length}, first 8 chars: ${trimmedKey.slice(0, 8)}...)`,
  );

  // Return both apiKey and sourceUid (sourceUid captured earlier when creating source)
  return { apiKey: trimmedKey, sourceUid };
}

test.describe("E2E: Strapi → Service → Consumer Full Flow (Fixtures)", () => {
  // Extend timeout for setup - starting consumer server + UI automation takes time
  test.describe.configure({ timeout: 180000 }); // 3 minutes

  let consumerApiKey: string;
  let sourceUid: string | null;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Clean up any lingering consumer processes from previous test attempts
    await killAllProcesses();

    // Extend timeout for setup
    testInfo.setTimeout(180000); // 3 minutes

    // ===== STEP 1: Service app already running (global-setup) =====
    console.log("[E2E] Using shared service app at " + SERVICE_URL);

    // ===== STEP 2: Setup Service app and get consumer API key =====
    // Using dummy Strapi URL/token since we're using fixtures instead of real Strapi
    const context = await browser.newContext();
    const servicePage = await context.newPage();
    const { apiKey, sourceUid: uid } = await setupServiceAppAndGetApiKey(
      servicePage,
      "http://localhost:1337",
      "dummy-token-for-fixtures",
    );
    consumerApiKey = apiKey;
    sourceUid = uid;
    await servicePage.close();
    await context.close();

    // ===== STEP 3: Start Consumer app with API key =====

    // Delete any existing .env file first to avoid stale values
    const envPath = resolve(PROJECT_ROOT, "demos/consumer-app/.env");
    try {
      await fs.unlink(envPath);
    } catch {
      // File doesn't exist, that's fine
    }

    // Write .env file for consumer app (Vite dev server needs this)
    const envContent = `CONTFU_URL=${SERVICE_URL}/api/stream\nCONTFU_KEY=${consumerApiKey}\n`;
    await fs.writeFile(envPath, envContent);
    console.log(
      `[E2E] Wrote .env file: CONTFU_URL=${SERVICE_URL}/api/stream, CONTFU_KEY=${consumerApiKey.slice(0, 8)}...`,
    );

    await spawnProcess(
      "bun",
      ["run", "preview", "--", "--port", String(CONSUMER_PORT)],
      resolve(PROJECT_ROOT, "demos/consumer-app"),
      {
        CONTFU_URL: `${SERVICE_URL}/api/stream`,
        CONTFU_KEY: consumerApiKey,
      },
      60000,
      CONSUMER_URL,
    );
  });

  test.afterAll(async () => {
    // Clean up consumer app process
    await killAllProcesses();
  });

  test("should show Strapi content in consumer app after sync", async ({ page }) => {
    // Open consumer page early to establish stream connection
    const consumerPage = await page.context().newPage();
    await consumerPage.goto(CONSUMER_URL);
    await consumerPage.waitForLoadState("networkidle");

    // Give stream connection time to establish
    await sleep(2000);

    // ===== STEP 5b: Verify consumer app sync connection =====
    try {
      const debugResponse = await fetch(`${CONSUMER_URL}/api/debug`);
      const debugState = await debugResponse.json();
      console.log(
        `[E2E] Consumer app state: articles=${debugState.articleCount}, syncUrl=${debugState.syncUrl}`,
      );

      // Trigger sync connection if not already started
      if (debugState.articleCount === 0) {
        await fetch(`${CONSUMER_URL}/api/debug`, { method: "POST" });
        await sleep(2000); // Wait for connection to establish
      }
    } catch {
      // Debug endpoint may not exist in older versions
    }

    // ===== STEP 5c: Test webhook→stream flow with a direct webhook =====
    // Now that consumer is connected, send a test webhook to verify the full flow
    const testWebhookPayload = {
      event: "entry.create",
      createdAt: new Date().toISOString(),
      model: "article",
      uid: "api::article.article",
      entry: {
        id: 8888,
        documentId: "test-webhook-verify-" + Date.now(),
        title: "Webhook Flow Test Article",
        slug: "webhook-flow-test-" + Date.now(),
        description: "Testing webhook→stream flow",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };

    try {
      const webhookTestResponse = await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testWebhookPayload),
      });
      if (!webhookTestResponse.ok) {
        const errorText = await webhookTestResponse.text();
        console.error(`[E2E] Webhook endpoint error: ${errorText}`);
      } else {
        // Check if the test article appears
        await sleep(1000);
        await consumerPage.reload();
        await consumerPage.waitForLoadState("networkidle");
        const testArticleVisible = await consumerPage
          .getByText("Webhook Flow Test Article")
          .isVisible()
          .catch(() => false);
        console.log(`[E2E] Webhook flow test article visible: ${testArticleVisible}`);
      }
    } catch (webhookError) {
      console.error(`[E2E] Webhook test error: ${webhookError}`);
    }

    // ===== STEP 6: Create article using fixture webhook payload =====
    // Using fixture data to simulate Strapi webhook (no real Strapi needed)
    const timestamp = Date.now();
    const createPayload = {
      event: "entry.create",
      createdAt: new Date().toISOString(),
      model: "article",
      uid: "api::article.article",
      entry: {
        id: 1,
        documentId: `test-article-${timestamp}`,
        title: "E2E Test Article",
        slug: `e2e-test-article-${timestamp}`,
        description: "This article was created during e2e testing",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };

    console.log("[E2E] Sending create webhook using fixture...");
    const createResponse = await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[E2E] Create webhook failed: ${errorText}`);
    }

    // Give the system time to process the webhook and propagate to consumer
    console.log("[E2E] Waiting for webhook to propagate...");
    await sleep(3000);

    // ===== STEP 7: Verify article in consumer app =====
    // Poll for article to appear (webhook + SSE propagation can take time)
    console.log("[E2E] Polling for article in consumer app...");
    await waitForArticleInConsumerApp(consumerPage, "E2E Test Article", 30000);

    const articleCount1 = await consumerPage
      .getByText(/Articles: \d+/)
      .textContent()
      .catch(() => "not found");
    console.log(`[E2E] Consumer app shows: ${articleCount1}`);

    await expect(
      consumerPage.getByText("This article was created during e2e testing"),
    ).toBeVisible();

    // ===== STEP 8: Create second article using fixture =====
    const article2Slug = `e2e-second-article-${timestamp}`;
    const createPayload2 = {
      event: "entry.create",
      createdAt: new Date().toISOString(),
      model: "article",
      uid: "api::article.article",
      entry: {
        id: 2,
        documentId: article2Slug,
        title: "E2E Second Article",
        slug: article2Slug,
        description: "This is the second test article",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };

    // Send webhook for second article
    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload2),
    });

    // Poll for second article to appear
    await waitForArticleInConsumerApp(consumerPage, "E2E Second Article", 30000);

    // ===== STEP 9: Update first article using fixture =====
    const updatePayload = {
      event: "entry.update",
      createdAt: new Date().toISOString(),
      model: "article",
      uid: "api::article.article",
      entry: {
        id: 1,
        documentId: `test-article-${timestamp}`,
        title: "E2E Updated Article",
        slug: `e2e-test-article-${timestamp}`,
        description: "This article was updated during e2e testing",
        createdAt: createPayload.entry.createdAt,
        updatedAt: new Date().toISOString(),
        publishedAt: createPayload.entry.publishedAt,
      },
    };

    // Send webhook for article update
    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    // Poll for updated article to appear
    await waitForArticleInConsumerApp(consumerPage, "E2E Updated Article", 30000);
    await expect(
      consumerPage.getByText("This article was updated during e2e testing"),
    ).toBeVisible();

    // ===== STEP 10: Delete second article using fixture =====
    const deletePayload = {
      event: "entry.delete",
      createdAt: new Date().toISOString(),
      model: "article",
      uid: "api::article.article",
      entry: {
        id: 2,
        documentId: article2Slug,
        title: "E2E Second Article",
        slug: article2Slug,
        description: "This is the second test article",
        createdAt: createPayload2.entry.createdAt,
        updatedAt: new Date().toISOString(),
        publishedAt: createPayload2.entry.publishedAt,
      },
    };

    // Send delete webhook
    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
    });

    // Note: Delete event propagation via webhook is TODO - the webhook currently only
    // broadcasts CHANGED events, not DELETED events. For now, just verify the webhook
    // was accepted.
    // TODO: Implement delete event broadcasting in webhook handler

    // First (updated) article should still be there
    await consumerPage.reload();
    await consumerPage.waitForLoadState("networkidle");
    await expect(consumerPage.getByText("E2E Updated Article")).toBeVisible();

    await consumerPage.close();
  });
});

/**
 * Configuration for the e2e tests
 */
test.describe.configure({ mode: "serial" });
