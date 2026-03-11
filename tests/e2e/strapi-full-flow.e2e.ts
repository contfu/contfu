/**
 * End-to-end Playwright test for the full Strapi -> Service -> Client flow.
 *
 * This test uses captured webhook fixtures instead of starting a real Strapi instance.
 * The service app is started by global-setup.ts (shared across all test files).
 *
 * Flow:
 * 1. Service app already running (global-setup)
 * 2. Playwright: Login, create Strapi connection, create source collection bound to it,
 *    create CLIENT connection, create target collection, add flow, capture API key
 * 3. Start connect() from @contfu/contfu to stream events into an in-memory SQLite DB
 * 4. Send webhook payloads directly (simulating Strapi webhooks)
 * 5. Verify content via contfu() against the local DB and via HTTP
 */
import { expect, test, type Page } from "@playwright/test";
import { setTimeout as sleep } from "node:timers/promises";
import { connect, contfu, listCollections, type QueryResult } from "contfu";
import { spawn, type ChildProcess } from "node:child_process";

// Port configuration
const SERVICE_URL = process.env.E2E_SERVICE_URL || "http://localhost:8011";

// Test data
const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

// Local query client -- queries the in-process SQLite DB directly
const q = contfu<Record<string, Record<string, unknown>>>();

/**
 * Poll contfu() until a matcher returns true.
 */
async function waitForItems(
  match: (result: QueryResult) => boolean,
  timeoutMs = 15000,
  pollIntervalMs = 50,
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
 * Login to the service app.
 */
async function login(page: Page): Promise<void> {
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login|Authenticate/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

/**
 * Setup service app: login, create Strapi connection, create collections,
 * create CLIENT connection, add flow, capture API key.
 * Returns API key and connection UID for webhook configuration.
 */
async function setupServiceAppAndGetApiKey(
  page: Page,
  strapiUrl: string,
  strapiApiToken: string,
): Promise<{ apiKey: string; connectionUid: string }> {
  console.log("[E2E] Setting up service app...");

  // === Login ===
  await login(page);

  // === Create a Strapi connection ===
  await page.goto(`${SERVICE_URL}/connections`);
  await page.waitForLoadState("networkidle");

  // Click "add source" button to show the source form
  await page.getByRole("button", { name: /add source/i }).click();

  // Fill the source connection form
  // Select Strapi provider
  const providerSelect = page.locator("select");
  await providerSelect.first().selectOption("strapi");

  // Fill name
  await page.locator('form input[placeholder="My workspace"]').fill("E2E Strapi Demo");

  // Fill API token
  await page.locator('form input[type="password"]').fill(strapiApiToken);

  // Submit
  await page.getByRole("button", { name: /Add Connection/i }).click();
  await page.waitForLoadState("networkidle");
  await sleep(1000);

  // Find the Strapi connection in the list and navigate to its detail page
  const strapiLink = page.getByRole("link", { name: /E2E Strapi Demo/i });
  await strapiLink.waitFor({ state: "visible", timeout: 10000 });
  await strapiLink.click();
  await page.waitForURL(/\/connections\//, { timeout: 10000 });

  // Get connection UID from the detail page
  const connectionUrl = page.url();
  const connectionIdMatch = connectionUrl.match(/\/connections\/([^/]+)/);
  const connectionId = connectionIdMatch ? connectionIdMatch[1] : null;
  console.log(`[E2E] Strapi connection created (encoded ID: ${connectionId})`);

  // Get the UID from the page (displayed as "uid: <code>...")
  let connectionUid = "";
  const uidCode = page.locator("code").first();
  await uidCode.waitFor({ state: "visible", timeout: 5000 });
  connectionUid = (await uidCode.textContent())?.trim() ?? "";
  console.log(`[E2E] Connection UID: ${connectionUid}`);
  console.log(`[E2E] Webhook URL: ${SERVICE_URL}/webhooks/strapi/${connectionUid}`);

  // === Create a source collection bound to the Strapi connection ===
  // Navigate to collections/new with connectionId and ref for api::article.article
  await page.goto(
    `${SERVICE_URL}/collections/new?connectionId=${connectionId}&ref=api::article.article`,
  );
  await page.waitForLoadState("networkidle");

  // Fill display name
  const displayNameInput = page.locator('input[name="displayName"]');
  await displayNameInput.fill("Articles");
  await page.getByRole("button", { name: /Create Collection/i }).click();

  // Wait for redirect to collection detail page
  await page.waitForURL(/\/collections\/[^/]+$/, { timeout: 10000 });
  const sourceCollectionUrl = page.url();
  const sourceCollectionId = sourceCollectionUrl.match(/\/collections\/([^/]+)/)![1];
  console.log(`[E2E] Source collection created (ID: ${sourceCollectionId})`);

  // === Create a CLIENT connection ===
  await page.goto(`${SERVICE_URL}/connections`);
  await page.waitForLoadState("networkidle");

  // Click "add consumer" button
  await page.getByRole("button", { name: /add consumer/i }).click();

  // Fill consumer name
  await page.locator('form input[placeholder="My App"]').fill("E2E Consumer App");

  // Submit
  await page.getByRole("button", { name: /Create Consumer/i }).click();
  await page.waitForLoadState("networkidle");
  await sleep(1000);

  // Capture the API key from the UI (shown after creation)
  const apiKeyContainer = page.locator('[data-testid="created-api-key"]');
  await apiKeyContainer.waitFor({ state: "visible", timeout: 10000 });
  const apiKeyCode = apiKeyContainer.locator("code");
  const apiKey = (await apiKeyCode.textContent())?.trim() ?? "";

  if (!apiKey || apiKey.length < 30) {
    await page.screenshot({ path: "api-key-capture-debug.png" });
    throw new Error(
      "Could not capture API key from service app UI - see api-key-capture-debug.png",
    );
  }
  console.log(
    `[E2E] Captured consumer API key (length: ${apiKey.length}, first 8: ${apiKey.slice(0, 8)}...)`,
  );

  // Navigate to the CLIENT connection detail to get its ID
  const clientLink = page.getByRole("link", { name: /E2E Consumer App/i });
  await clientLink.waitFor({ state: "visible", timeout: 10000 });
  await clientLink.click();
  await page.waitForURL(/\/connections\//, { timeout: 10000 });

  const clientConnectionUrl = page.url();
  const clientConnectionId = clientConnectionUrl.match(/\/connections\/([^/]+)/)![1];
  console.log(`[E2E] CLIENT connection created (ID: ${clientConnectionId})`);

  // === Create a target collection bound to the CLIENT connection ===
  await page.goto(`${SERVICE_URL}/collections/new?connectionId=${clientConnectionId}`);
  await page.waitForLoadState("networkidle");

  await page.locator('input[name="displayName"]').fill("Articles");
  await page.getByRole("button", { name: /Create Collection/i }).click();
  await page.waitForURL(/\/collections\/[^/]+$/, { timeout: 10000 });
  const targetCollectionUrl = page.url();
  const targetCollectionId = targetCollectionUrl.match(/\/collections\/([^/]+)/)![1];
  console.log(`[E2E] Target collection created (ID: ${targetCollectionId})`);

  // === Add a flow from source collection to target collection ===
  // On the target collection detail page, add a source flow
  await page.waitForLoadState("networkidle");
  await sleep(500);

  // Open the source collection combobox
  const sourceCombobox = page.getByRole("combobox").first();
  await sourceCombobox.waitFor({ state: "visible", timeout: 10000 });
  await sourceCombobox.click();

  // Select the source "Articles" collection
  // The combobox shows collections from other connections
  await page.getByRole("option", { name: /Articles/i }).click();

  // Click "Add Source" button
  await page.getByRole("button", { name: /Add Source/i }).click();
  await sleep(1000);
  console.log("[E2E] Flow added from source to target collection");

  return { apiKey, connectionUid };
}

// TODO: Fix after UI redesign changed button/link labels (tracked separately)
test.describe.skip("E2E: Strapi -> Service -> Consumer Full Flow (Fixtures)", () => {
  // Extend timeout for setup - UI automation takes time
  test.describe.configure({ timeout: 180000 }); // 3 minutes

  let consumerApiKey: string;
  let connectionUid: string;
  let abortController: AbortController;
  let connectPromise: Promise<void>;

  test.beforeAll(async ({ browser }, testInfo) => {
    // Extend timeout for setup
    testInfo.setTimeout(180000); // 3 minutes

    // ===== STEP 1: Service app already running (global-setup) =====
    console.log("[E2E] Using shared service app at " + SERVICE_URL);

    // ===== STEP 2: Setup Service app and get consumer API key =====
    const context = await browser.newContext();
    const servicePage = await context.newPage();
    const { apiKey, connectionUid: uid } = await setupServiceAppAndGetApiKey(
      servicePage,
      "http://localhost:1337",
      "dummy-token-for-fixtures",
    );
    consumerApiKey = apiKey;
    connectionUid = uid;
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
    const createResponse = await fetch(`${SERVICE_URL}/webhooks/strapi/${connectionUid}`, {
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${connectionUid}`, {
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${connectionUid}`, {
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

    await fetch(`${SERVICE_URL}/webhooks/strapi/${connectionUid}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(deletePayload),
    });

    // Updated first article should still be there
    const result4 = await q({ collection: "articles", limit: 100 });
    expect(result4.data.some((item) => item.props.title === "E2E Updated Article")).toBe(true);
  });

  test("should reflect collection rename in local DB", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Login
    await login(page);

    // Find the CLIENT connection to get its ID
    await page.goto(`${SERVICE_URL}/connections`);
    await page.waitForLoadState("networkidle");
    const clientLink = page.getByRole("link", { name: /E2E Consumer App/i });
    await clientLink.click();
    await page.waitForURL(/\/connections\//, { timeout: 10000 });
    const clientConnectionId = page.url().match(/\/connections\/([^/]+)/)![1];

    // Create a new standalone collection bound to the CLIENT connection
    await page.goto(`${SERVICE_URL}/collections/new?connectionId=${clientConnectionId}`);
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="displayName"]').fill("Rename Test");
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/[^/]+$/, { timeout: 10000 });

    const newCollectionId = page.url().match(/\/collections\/([^/]+)/)![1];
    console.log(`[E2E] Created dedicated collection for rename test (ID: ${newCollectionId})`);

    // Wait for the COLLECTION_SCHEMA event to create the collection in the local DB
    console.log("[E2E] Waiting for 'renameTest' collection to appear in local DB...");
    const startSchema = Date.now();
    let schemaReady = false;
    while (Date.now() - startSchema < 15000) {
      const collections = await listCollections();
      if (collections.some((c) => c.name === "renameTest")) {
        schemaReady = true;
        break;
      }
      await sleep(50);
    }
    expect(schemaReady).toBe(true);

    // Rename the collection via UI
    console.log("[E2E] Renaming collection from 'renameTest' to 'renamedCollection' via UI...");
    await page.goto(`${SERVICE_URL}/collections/${newCollectionId}`);
    await page.waitForLoadState("networkidle");

    // Click the pencil icon to open the rename popover
    await page.locator('[data-slot="popover-trigger"]').first().click();
    await page.waitForSelector('[data-slot="popover-content"]', { timeout: 5000 });

    const popover = page.locator('[data-slot="popover-content"]');
    await popover.getByLabel(/Display Name/i).fill("Renamed Collection");
    await popover.getByLabel(/Identifier Name/i).fill("renamedCollection");
    await popover.getByRole("button", { name: /Save/i }).click();

    // Poll until the rename is reflected in the local DB
    const start = Date.now();
    let renamed = false;
    while (Date.now() - start < 10000) {
      const collections = await listCollections();
      if (collections.some((c) => c.name === "renamedCollection")) {
        renamed = true;
        break;
      }
      await sleep(50);
    }
    expect(renamed).toBe(true);

    // Old name should no longer exist
    const collectionsAfter = await listCollections();
    expect(collectionsAfter.some((c) => c.name === "renameTest")).toBe(false);
    expect(collectionsAfter.some((c) => c.name === "renamedCollection")).toBe(true);

    // "articles" collection should be completely untouched
    expect(collectionsAfter.some((c) => c.name === "articles")).toBe(true);

    console.log("[E2E] Collection rename verified (isolated test, no rename-back needed)");

    await page.close();
    await context.close();
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
        50,
      );
      expect(clientReady).toBe(true);
      console.log("[E2E] Client app is ready");

      // Give the client app time to establish its sync stream connection
      await sleep(3000);

      // Send a NEW webhook event
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
      const webhookRes = await fetch(`${SERVICE_URL}/webhooks/strapi/${connectionUid}`, {
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
        50,
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
