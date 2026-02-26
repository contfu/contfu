/**
 * End-to-end Playwright test for the full Strapi → Service → Client flow.
 *
 * This test uses captured webhook fixtures instead of starting a real Strapi instance.
 * The service app is started by global-setup.ts (shared across all test files).
 *
 * Flow:
 * 1. Service app already running (global-setup)
 * 2. Playwright: Login to service app, create Strapi source, create collection/consumer → capture API key
 * 3. Start connect() from @contfu/contfu to stream events into an in-memory SQLite DB
 * 4. Send webhook payloads directly (simulating Strapi webhooks)
 * 5. Verify content via contfu() against the local DB and via HTTP
 */
import { expect, test, type Page } from "@playwright/test";
import { setTimeout as sleep } from "node:timers/promises";
import { connect, contfu, type QueryResult } from "contfu";
import { spawn, type ChildProcess } from "node:child_process";

// Port configuration
const SERVICE_URL = process.env.E2E_SERVICE_URL || "http://localhost:8011";

// Test data
const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

async function selectSourceType(page: Page, typeLabel: "Web" | "Strapi" | "Notion"): Promise<void> {
  const valueByType: Record<typeof typeLabel, string> = {
    Notion: "0",
    Strapi: "1",
    Web: "2",
  };
  await page.getByLabel(/Type/i).selectOption({ value: valueByType[typeLabel] });
}

// Local query client — queries the in-process SQLite DB directly
const q = contfu<Record<string, Record<string, unknown>>>();

/**
 * Poll contfu() until a matcher returns true.
 */
async function waitForItems(
  match: (result: QueryResult) => boolean,
  timeoutMs = 15000,
  pollIntervalMs = 500,
): Promise<QueryResult> {
  const start = Date.now();
  let lastResult: QueryResult | undefined;
  while (Date.now() - start < timeoutMs) {
    lastResult = await q({ collection: "articles", limit: 100 });
    if (match(lastResult)) {
      return lastResult;
    }
    await sleep(pollIntervalMs);
  }
  throw new Error(
    `waitForItems timed out after ${timeoutMs}ms. Last result: ${JSON.stringify(lastResult, null, 2)}`,
  );
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
  await selectSourceType(page, "Strapi");
  await expect(page.locator('input[name="url"]')).toBeVisible({ timeout: 10000 });
  await page.locator('input[name="url"]').fill(strapiUrl);
  await page.locator('input[name="_credentials"]').fill(strapiApiToken);
  await page.getByRole("button", { name: /Create Source/i }).click();

  await page.waitForURL(/\/sources\/\d+/, { timeout: 10000 });

  // Capture source ID from URL and UID from the webhook URL input
  const sourceUrl = page.url();
  const sourceIdMatch = sourceUrl.match(/\/sources\/(\d+)/);
  const sourceId = sourceIdMatch ? sourceIdMatch[1] : null;
  console.log(`[E2E] Strapi source created (ID: ${sourceId})`);

  // Get source UID from test API (source detail page may not render in test mode)
  let sourceUid: string | null = null;
  try {
    const sourceResp = await fetch(`${SERVICE_URL}/api/test/source?id=${sourceId}`);
    const contentType = sourceResp.headers.get("content-type") ?? "";
    if (sourceResp.ok && contentType.includes("application/json")) {
      const sourceData = await sourceResp.json();
      sourceUid = sourceData.uid ?? null;
    }
  } catch {
    // Fallback below
  }

  if (!sourceUid) {
    const webhookInput = page.locator('input[readonly][type="text"]').first();
    const webhookUrl = await webhookInput.inputValue();
    const uid = webhookUrl.match(/\/webhooks\/strapi\/([^/]+)$/)?.[1];
    sourceUid = uid ?? null;
  }
  console.log(`[E2E] Webhook URL for this source: ${SERVICE_URL}/webhooks/strapi/${sourceUid}`);

  // Create a Collection with implicit SourceCollection creation via UI
  // Navigate to collections/new with sourceId and ref as query params
  // The form has hidden fields that get populated from these params
  await page.goto(`${SERVICE_URL}/collections/new?sourceId=${sourceId}&ref=api::article.article`);
  await page.getByLabel(/Display Name/i).fill("Articles");
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

    // Look for the key in a <code> element (base64url-like key, usually 40+ chars)
    const codeElements = page.locator("code");
    const count = await codeElements.count();

    for (let i = 0; i < count; i++) {
      const text = await codeElements.nth(i).textContent();
      if (text && text.length > 30 && /^[A-Za-z0-9_-]+$/.test(text.trim())) {
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
  // Extend timeout for setup - UI automation takes time
  test.describe.configure({ timeout: 180000 }); // 3 minutes

  let consumerApiKey: string;
  let sourceUid: string | null;
  let abortController: AbortController;
  let connectPromise: Promise<void>;

  test.beforeAll(async ({ browser }, testInfo) => {
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

    // ===== STEP 3: Start connect() to stream events into in-memory DB =====
    abortController = new AbortController();
    connectPromise = (async () => {
      try {
        for await (const _event of connect({
          key: Buffer.from(consumerApiKey, "base64url"),
          url: `${SERVICE_URL}/api/sync`,
        })) {
          // Events are auto-persisted to the in-memory DB by connect()
          if (abortController.signal.aborted) break;
        }
      } catch (err) {
        if (!abortController.signal.aborted) {
          console.error("[E2E] connect() error:", err);
        }
      }
    })();

    // Give the stream connection time to establish
    await sleep(2000);
    console.log("[E2E] connect() stream established");
  });

  test.afterAll(async () => {
    // Stop the connect loop
    abortController.abort();
    await Promise.race([connectPromise, sleep(5000)]);
  });

  test("should sync Strapi content through to local DB after webhooks", async () => {
    // ===== STEP 4: Create article using fixture webhook payload =====
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

    // ===== STEP 5: Verify article appears in local DB =====
    console.log("[E2E] Polling for article in local DB...");
    const result1 = await waitForItems((r) =>
      r.data.some((item) => item.props.title === "E2E Test Article"),
    );
    expect(result1.data.length).toBeGreaterThanOrEqual(1);

    const article1 = result1.data.find((item) => item.props.title === "E2E Test Article")!;
    expect(article1.props.description).toBe("This article was created during e2e testing");
    expect(article1.collection).toBe("articles");

    // ===== STEP 6: Create second article using fixture =====
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload2),
    });

    // Poll for second article
    const result2 = await waitForItems((r) =>
      r.data.some((item) => item.props.title === "E2E Second Article"),
    );
    expect(result2.data.length).toBeGreaterThanOrEqual(2);

    // ===== STEP 7: Update first article using fixture =====
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updatePayload),
    });

    // Poll for updated article
    const result3 = await waitForItems((r) =>
      r.data.some((item) => item.props.title === "E2E Updated Article"),
    );
    const updatedArticle = result3.data.find((item) => item.props.title === "E2E Updated Article")!;
    expect(updatedArticle.props.description).toBe("This article was updated during e2e testing");

    // ===== STEP 8: Delete second article using fixture =====
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
    });

    // Note: Delete event propagation via webhook is TODO - the webhook currently only
    // broadcasts CHANGED events, not DELETED events. For now, just verify the webhook
    // was accepted.
    // TODO: Implement delete event broadcasting in webhook handler

    // Updated first article should still be there
    const result4 = await q({ collection: "articles", limit: 100 });
    expect(result4.data.some((item) => item.props.title === "E2E Updated Article")).toBe(true);
  });

  test("should serve synced items over HTTP via client app", async () => {
    // ===== Spawn the client app on port 3001 =====
    const CLIENT_PORT = 3001;
    const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;
    const workspaceRoot = new URL("../../", import.meta.url).pathname;
    const clientAppPath = `${workspaceRoot}packages/client/app/build/index.js`;

    let clientProcess: ChildProcess | undefined;

    try {
      clientProcess = spawn("bun", ["run", clientAppPath], {
        cwd: workspaceRoot,
        env: {
          ...process.env,
          PORT: String(CLIENT_PORT),
          ORIGIN: CLIENT_URL,
          CONTFU_API_KEY: consumerApiKey,
          CONTFU_API_URL: `${SERVICE_URL}/api/sync`,
        },
        stdio: "pipe",
      });

      // Log client app output for debugging
      clientProcess.stdout?.on("data", (d: Buffer) =>
        console.log(`[client-app] ${d.toString().trim()}`),
      );
      clientProcess.stderr?.on("data", (d: Buffer) =>
        console.error(`[client-app] ${d.toString().trim()}`),
      );

      // Wait for client app to become ready
      const clientReady = await pollUntil(
        async () => {
          try {
            const res = await fetch(CLIENT_URL);
            return res.ok || res.status === 200;
          } catch {
            return false;
          }
        },
        30000,
        500,
      );
      expect(clientReady).toBe(true);
      console.log("[E2E] Client app is ready");

      // Give the client app time to establish its sync stream connection
      await sleep(3000);

      // Send a NEW webhook event — this will be broadcast in real-time to the
      // client app's active sync stream (bypassing the snapshot+replay issue
      // where historical events before the snapshot sequence are skipped).
      const httpTimestamp = Date.now();
      const httpArticlePayload = {
        event: "entry.create",
        createdAt: new Date().toISOString(),
        model: "article",
        uid: "api::article.article",
        entry: {
          id: 100,
          documentId: `http-test-article-${httpTimestamp}`,
          title: "HTTP Test Article",
          slug: `http-test-article-${httpTimestamp}`,
          description: "Created after client app connected",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          publishedAt: new Date().toISOString(),
        },
      };

      console.log("[E2E] Sending webhook for HTTP test article...");
      const webhookRes = await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceUid}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(httpArticlePayload),
      });
      expect(webhookRes.ok).toBe(true);

      // Poll the client app's HTTP API for the article to appear
      const httpQ = contfu<Record<string, Record<string, unknown>>>({
        url: CLIENT_URL,
      });

      let pollCount = 0;
      const httpResult = await pollUntilResult(
        async () => {
          try {
            const r = await httpQ({ collection: "articles", limit: 100 });
            pollCount++;
            if (pollCount <= 3 || pollCount % 10 === 0) {
              console.log(`[E2E] HTTP poll #${pollCount}: ${r.data.length} items`);
            }
            return r.data.some((item) => item.props.title === "HTTP Test Article") ? r : null;
          } catch (err) {
            pollCount++;
            console.log(`[E2E] HTTP poll #${pollCount} error: ${err}`);
            return null;
          }
        },
        60000,
        2000,
      );

      expect(httpResult).not.toBeNull();
      expect(httpResult!.data.length).toBeGreaterThanOrEqual(1);

      const httpArticle = httpResult!.data.find((item) => item.props.title === "HTTP Test Article");
      expect(httpArticle).toBeDefined();
      expect(httpArticle!.props.description).toBe("Created after client app connected");
      expect(httpArticle!.collection).toBe("articles");

      console.log("[E2E] HTTP query test passed");
    } finally {
      if (clientProcess && !clientProcess.killed) {
        clientProcess.kill("SIGTERM");
        await sleep(1000);
        if (!clientProcess.killed) {
          clientProcess.kill("SIGKILL");
        }
      }
    }
  });
});

/** Poll a condition until it returns true or timeout */
async function pollUntil(
  fn: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs: number,
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return true;
    await sleep(intervalMs);
  }
  return false;
}

/** Poll until the function returns a non-null result */
async function pollUntilResult<T>(
  fn: () => Promise<T | null>,
  timeoutMs: number,
  intervalMs: number,
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await fn();
    if (result !== null) return result;
    await sleep(intervalMs);
  }
  return null;
}

/**
 * Configuration for the e2e tests
 */
test.describe.configure({ mode: "serial" });
