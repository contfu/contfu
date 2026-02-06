/**
 * End-to-end Playwright test for the full Strapi → Service → Client flow.
 *
 * This test launches real servers and verifies the complete integration:
 * 1. Strapi via Docker (contfu-strapi-test:latest with pre-configured article content type)
 * 2. Service app (packages/service/app)
 * 3. Consumer app (demos/consumer-app) - started AFTER API key is captured
 *
 * Flow:
 * 1. Start Strapi → wait ready
 * 2. Start Service app → wait ready
 * 3. Playwright: Login to Strapi admin, create API token
 * 4. Playwright: Login to service app, create Strapi source, create client → capture API key
 * 5. Start Consumer app with CONTFU_API_KEY env var
 * 6. Playwright: Create/update articles in Strapi admin UI
 * 7. Playwright: Verify content in Consumer app
 *
 * NOTE: All Strapi operations are done via Playwright UI automation, NOT REST API calls.
 */
import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { promises as fs } from "node:fs";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { startStrapiDocker, stopStrapiDocker } from "./setup";
// WebSocket client - currently unused since WS testing is disabled in vite preview mode
// TODO: Re-enable when WS testing is fixed
// import { connect } from "@contfu/client";
import type { ItemEvent } from "@contfu/core";

// Project root (contfu/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// Port configuration
const STRAPI_PORT = 1337;
const SERVICE_PORT = 8011; // Configured in vite.config.ts
const CONSUMER_PORT = 4000;

// In CI, Strapi runs in a service container accessible via STRAPI_HOST
const STRAPI_HOST = process.env.STRAPI_HOST || "localhost";
const STRAPI_URL = `http://${STRAPI_HOST}:${STRAPI_PORT}`;
const STRAPI_ADMIN_URL = `${STRAPI_URL}/admin`;
const SERVICE_URL = `http://localhost:${SERVICE_PORT}`;
const CONSUMER_URL = `http://localhost:${CONSUMER_PORT}`;

// Test data
const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

// Strapi admin credentials
const STRAPI_ADMIN = {
  email: "admin@example.com",
  password: "Admin123!",
  firstname: "Admin",
  lastname: "User",
};

// Track spawned processes for cleanup
const processes: ChildProcess[] = [];

/**
 * Spawn a process and wait for it to be ready (via stdout pattern or URL polling)
 * Note: When using `bun run`, stdout patterns may not work because bun's script
 * runner writes directly to the terminal. Use readyUrl for reliable detection.
 */
async function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  readyPattern: RegExp | string | null,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 120000,
  forwardOutput = false,
  readyUrl?: string,
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

    const checkReady = (data: Buffer) => {
      const text = data.toString();
      output += text;

      // Forward output for debugging in CI
      if (process.env.CI) {
        process.stdout.write(`[${command}] ${text}`);
      } else if (forwardOutput && isReady) {
        process.stdout.write(`[${command}] ${text}`);
      }

      // Only check pattern if provided
      if (readyPattern && !isReady) {
        const pattern = typeof readyPattern === "string" ? new RegExp(readyPattern) : readyPattern;
        if (pattern.test(output)) {
          markReady();
        }
      }
    };

    proc.stdout?.on("data", checkReady);
    proc.stderr?.on("data", checkReady);

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on("exit", (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`Process exited with code ${code}: ${output}`));
      }
    });

    // If readyUrl provided, poll it instead of (or in addition to) stdout pattern
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
      pollUrl();
    }
  });
}

/**
 * Kill all spawned processes
 */
async function killAllProcesses(): Promise<void> {
  for (const proc of processes) {
    if (proc.pid && !proc.killed) {
      // Kill process group to ensure child processes are also killed
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        // Process may already be dead
        proc.kill("SIGTERM");
      }
    }
  }
  processes.length = 0;
  // Give processes time to clean up
  await sleep(1000);
}

/**
 * Wait for a URL to be accessible
 */
async function waitForUrl(url: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  let lastError = "";
  let attempts = 0;
  while (Date.now() - start < timeoutMs) {
    attempts++;
    try {
      const response = await fetch(url, { method: "GET" });
      if (response.ok || response.status === 403 || response.status === 404 || response.status === 500) {
        console.log(`[E2E] URL ${url} accessible (status ${response.status})`);
        return;
      }
      lastError = `status ${response.status}`;
    } catch (e) {
      lastError = String(e);
    }
    // Log progress every 10 attempts (~5 seconds)
    if (attempts % 10 === 0) {
      const elapsed = Math.round((Date.now() - start) / 1000);
      console.log(`[E2E] Still waiting for ${url} (${elapsed}s, last: ${lastError})`);
    }
    await sleep(500);
  }
  throw new Error(
    `URL ${url} did not become accessible within ${timeoutMs}ms. Last error: ${lastError}`,
  );
}

/**
 * Register admin user in Strapi via the admin UI
 * (Only needed on first run - Strapi shows registration page if no admin exists)
 */
async function registerStrapiAdmin(page: Page): Promise<void> {
  await page.goto(STRAPI_ADMIN_URL);
  await page.waitForLoadState("networkidle");

  // Distinguish between registration and login page by checking for firstname field
  // Registration page has firstname/lastname fields, login page only has email/password
  const firstnameField = page.locator('input[name="firstname"]');
  const isRegistrationPage = await firstnameField.isVisible({ timeout: 3000 }).catch(() => false);

  if (isRegistrationPage) {
    console.log("[E2E] Registering new Strapi admin user...");

    // Fill registration form - use name attributes for precise matching
    await firstnameField.fill(STRAPI_ADMIN.firstname);
    await page.locator('input[name="lastname"]').fill(STRAPI_ADMIN.lastname);
    await page.locator('input[name="email"]').fill(STRAPI_ADMIN.email);
    await page.locator('input[name="password"]').fill(STRAPI_ADMIN.password);
    await page.locator('input[name="confirmPassword"]').fill(STRAPI_ADMIN.password);

    // Accept terms if checkbox exists
    const termsCheckbox = page.getByRole("checkbox");
    if (await termsCheckbox.isVisible().catch(() => false)) {
      await termsCheckbox.check();
    }

    // Submit registration
    await page.getByRole("button", { name: /Let's start/i }).click();

    // Wait for redirect away from auth
    await page.waitForURL(/\/admin(?!\/auth)/, { timeout: 30000 });

    // Handle onboarding questionnaire ("Tell us a bit more about yourself")
    // This appears on first registration and needs to be skipped
    const skipButton = page.getByRole("button", { name: /Skip this question/i });
    if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log("[E2E] Skipping Strapi onboarding questionnaire...");
      await skipButton.click();
      await page.waitForLoadState("networkidle");
    }

    console.log("[E2E] Strapi admin registered successfully");
  } else {
    // Already have an admin, need to login
    console.log("[E2E] Admin exists, logging in instead...");
    await loginStrapiAdmin(page);
  }
}

/**
 * Login to Strapi admin UI
 */
async function loginStrapiAdmin(page: Page): Promise<void> {
  await page.goto(STRAPI_ADMIN_URL);
  await page.waitForLoadState("networkidle");

  // Check if already logged in (redirected to dashboard)
  if (!page.url().includes("/auth/login")) {
    console.log("[E2E] Already logged into Strapi admin");
    return;
  }

  console.log("[E2E] Logging into Strapi admin...");
  await page.locator('input[name="email"]').fill(STRAPI_ADMIN.email);
  await page.locator('input[name="password"]').fill(STRAPI_ADMIN.password);
  await page.getByRole("button", { name: /Login/i }).click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/admin(?!\/auth)/, { timeout: 30000 });
  console.log("[E2E] Logged into Strapi admin");
}

/**
 * Create an article via the Strapi admin Content Manager UI
 */
async function createArticleViaUI(
  page: Page,
  article: { title: string; slug: string; description?: string },
): Promise<void> {
  console.log(`[E2E] Creating article via Strapi UI: ${article.title}`);

  // Navigate to Content Manager
  await page.goto(`${STRAPI_ADMIN_URL}/content-manager/collection-types/api::article.article`);
  await page.waitForLoadState("networkidle");

  // Click "Create new entry" button
  await page.getByRole("link", { name: /Create new entry/i }).click();
  await page.waitForLoadState("networkidle");

  // Fill in article fields
  await page.locator('input[name="title"]').fill(article.title);
  await page.locator('input[name="slug"]').fill(article.slug);

  if (article.description) {
    // Description might be a textarea or rich text editor
    const descField = page.locator('textarea[name="description"], input[name="description"]');
    if (await descField.isVisible().catch(() => false)) {
      await descField.fill(article.description);
    }
  }

  // Save the article
  await page.getByRole("button", { name: /Save/i }).click();

  // Wait for save confirmation (use first match since multiple success messages may appear)
  await expect(page.getByText(/Saved document/i).first()).toBeVisible({
    timeout: 10000,
  });

  // Publish the article so it's available via API
  await page.getByRole("button", { name: /Publish/i }).click();
  await sleep(2000); // Wait for publish to complete

  console.log(`[E2E] Article created and published: ${article.title}`);
}

/**
 * Update an article via the Strapi admin Content Manager UI
 * (kept for future use)
 */
async function _updateArticleViaUI(
  page: Page,
  originalTitle: string,
  updates: { title?: string; description?: string },
): Promise<void> {
  console.log(`[E2E] Updating article via Strapi UI: ${originalTitle}`);

  // Navigate to Content Manager article list
  await page.goto(`${STRAPI_ADMIN_URL}/content-manager/collection-types/api::article.article`);
  await page.waitForLoadState("networkidle");

  // Find and click on the article to edit (use first() in case there are duplicates from previous runs)
  await page.getByRole("gridcell", { name: originalTitle }).first().click();
  await page.waitForLoadState("networkidle");

  // Update fields
  if (updates.title) {
    const titleField = page.locator('input[name="title"]');
    await titleField.clear();
    await titleField.fill(updates.title);
  }

  if (updates.description) {
    const descField = page.locator('textarea[name="description"], input[name="description"]');
    if (await descField.isVisible().catch(() => false)) {
      await descField.clear();
      await descField.fill(updates.description);
    }
  }

  // Save the article
  await page.getByRole("button", { name: /Save/i }).click();

  // Wait for save confirmation
  await expect(page.getByText(/Saved/i).or(page.getByText(/Success/i))).toBeVisible({
    timeout: 10000,
  });

  console.log(`[E2E] Article updated: ${updates.title || originalTitle}`);
}

/**
 * Create an API token via Strapi admin UI and return it
 * (kept for future use)
 */
async function _createStrapiApiTokenViaUI(page: Page): Promise<string> {
  console.log("[E2E] Creating Strapi API token via UI...");

  // Navigate to Settings > API Tokens
  await page.goto(`${STRAPI_ADMIN_URL}/settings/api-tokens`);
  await page.waitForLoadState("networkidle");

  // Click "Create new API Token" button
  await page.getByRole("link", { name: /Create new API Token/i }).click();
  await page.waitForLoadState("networkidle");

  // Fill token details
  const tokenName = `e2e-test-token-${Date.now()}`;
  await page.locator('input[name="name"]').fill(tokenName);
  await page.locator('textarea[name="description"]').fill("Token created for e2e tests");

  // Select token duration (required field!) - choose "Unlimited" or "90 days"
  await page.getByRole("combobox", { name: /Token duration/i }).click();
  // Try "Unlimited" first, fall back to longest available option
  const unlimitedOption = page.getByRole("option", { name: /Unlimited/i });
  if (await unlimitedOption.isVisible().catch(() => false)) {
    await unlimitedOption.click();
  } else {
    // Click the last option (usually longest duration)
    await page.getByRole("option").last().click();
  }

  // Select token type - Full access
  await page.getByRole("combobox", { name: /Token type/i }).click();
  await page.getByRole("option", { name: /Full access/i }).click();

  // Save the token
  await page.getByRole("button", { name: /Save/i }).click();

  // Wait for the token to be displayed - Strapi shows a warning message about copying
  await page.waitForSelector("text=/Make sure to copy this token/i", { timeout: 15000 });

  // Give UI time to render the token display
  await sleep(1000);

  // The token is displayed in a text element near the warning message
  // It's a long alphanumeric string shown above the form
  let apiToken = "";

  // Look for the token text - it's displayed as plain text in a div/span
  // The token warning message is "Make sure to copy this token, you won't be able to see it again!"
  // The token itself is displayed above this warning
  const pageContent = await page.content();

  // Extract token using regex - it's a very long alphanumeric string (usually 200+ chars)
  const tokenMatch = pageContent.match(/[a-f0-9]{100,}/i);
  if (tokenMatch) {
    apiToken = tokenMatch[0];
  }

  // Fallback: Try to get from any element containing long alphanumeric text
  if (!apiToken) {
    const allText = await page.locator("body").allInnerTexts();
    for (const text of allText) {
      // Split by whitespace and find long alphanumeric tokens
      const words = text.split(/\s+/);
      for (const word of words) {
        if (word.length > 100 && /^[a-f0-9]+$/i.test(word)) {
          apiToken = word;
          break;
        }
      }
      if (apiToken) break;
    }
  }

  if (!apiToken) {
    // Take a screenshot for debugging
    await page.screenshot({ path: "strapi-token-debug.png" });
    throw new Error("Could not retrieve Strapi API token from UI - see strapi-token-debug.png");
  }

  console.log("[E2E] Strapi API token created successfully");
  return apiToken.trim();
}

// Cache for Strapi admin token to avoid rate limiting
let cachedStrapiAdminToken: string | null = null;

/**
 * Get Strapi admin JWT token via API (cached to avoid rate limiting)
 */
async function getStrapiAdminToken(): Promise<string> {
  if (cachedStrapiAdminToken) {
    return cachedStrapiAdminToken;
  }

  const response = await fetch(`${STRAPI_URL}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: STRAPI_ADMIN.email,
      password: STRAPI_ADMIN.password,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.log(`[E2E] Strapi admin login failed: ${response.status} - ${errorBody}`);
    throw new Error(`Failed to get Strapi admin token: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  cachedStrapiAdminToken = data.data.token;
  return cachedStrapiAdminToken;
}

/**
 * Create the Article content type via Strapi Content-Type Builder API.
 * This is needed because naskio/strapi is a blank Strapi without content types.
 * (kept for future use)
 */
async function _createArticleContentType(): Promise<void> {
  console.log("[E2E] Creating Article content type via API...");

  const adminToken = await getStrapiAdminToken();

  // Check if article content type already exists
  const checkResponse = await fetch(`${STRAPI_URL}/content-type-builder/content-types`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  if (checkResponse.ok) {
    const existing = await checkResponse.json();
    const articleExists = existing.data?.some(
      (ct: { uid: string }) => ct.uid === "api::article.article"
    );
    if (articleExists) {
      console.log("[E2E] Article content type already exists");
      return;
    }
  }

  // Create the article content type
  const contentTypeDefinition = {
    contentType: {
      displayName: "Article",
      singularName: "article",
      pluralName: "articles",
      kind: "collectionType",
      draftAndPublish: true,
      attributes: {
        title: {
          type: "string",
          required: true,
        },
        slug: {
          type: "uid",
          targetField: "title",
          required: true,
        },
        description: {
          type: "text",
        },
        content: {
          type: "richtext",
        },
      },
    },
  };

  const createResponse = await fetch(`${STRAPI_URL}/content-type-builder/content-types`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify(contentTypeDefinition),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Failed to create Article content type: ${createResponse.status} - ${errorText}`);
  }

  console.log("[E2E] Article content type created, waiting for Strapi to reload...");

  // Strapi auto-restarts after content type changes - wait for it to come back
  await sleep(5000); // Give it time to start reloading

  // Poll until Strapi is ready again
  const maxWait = 60000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const healthCheck = await fetch(`${STRAPI_URL}/_health`);
      if (healthCheck.ok) {
        // Also verify admin is accessible
        const adminCheck = await fetch(`${STRAPI_URL}/admin/init`);
        if (adminCheck.ok) {
          console.log("[E2E] Strapi reloaded successfully");
          return;
        }
      }
    } catch {
      // Server still restarting
    }
    await sleep(2000);
  }

  throw new Error("Strapi did not come back up after content type creation");
}

/**
 * Create Strapi API token via Admin REST API (faster than UI)
 */
async function createStrapiApiTokenViaAPI(): Promise<string> {
  console.log("[E2E] Creating Strapi API token via REST API...");

  const adminToken = await getStrapiAdminToken();

  const response = await fetch(`${STRAPI_URL}/admin/api-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: `e2e-test-token-${Date.now()}`,
      description: "Token created for e2e tests via API",
      type: "full-access",
      lifespan: null, // Unlimited
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Strapi API token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const accessKey = data.data?.accessKey;

  if (!accessKey) {
    throw new Error("API token response missing accessKey");
  }

  console.log("[E2E] Strapi API token created via API");
  return accessKey;
}

/**
 * Create an article in Strapi via REST API (and optionally publish it)
 */
async function createArticleViaAPI(
  apiToken: string,
  article: { title: string; slug: string; description?: string },
  publish: boolean = true,
): Promise<{ documentId: string; id: number }> {
  console.log(`[E2E] Creating article via API: ${article.title}`);

  // In Strapi v5, use status: 'published' to create and publish in one call
  const url = publish
    ? `${STRAPI_URL}/api/articles?status=published`
    : `${STRAPI_URL}/api/articles`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ data: article }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create article: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[E2E] Article created${publish ? " and published" : ""} via API: ${article.title}`);
  return { documentId: data.data.documentId, id: data.data.id };
}

/**
 * Send a webhook to the service app to notify about an article change.
 * This simulates what Strapi would do if webhooks were triggered for Content API operations.
 * (Strapi 5 only fires webhooks for Admin UI/API changes, not Content API)
 */
async function sendArticleWebhook(
  sourceId: number,
  event: "entry.create" | "entry.update" | "entry.delete",
  article: {
    id: number;
    documentId: string;
    title: string;
    slug: string;
    description?: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const webhookPayload = {
    event,
    createdAt: now,
    model: "article",
    uid: "api::article.article",
    entry: {
      id: article.id,
      documentId: article.documentId,
      title: article.title,
      slug: article.slug,
      description: article.description || "",
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    },
  };

  const response = await fetch(`${SERVICE_URL}/webhooks/strapi/${sourceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(webhookPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[E2E] Webhook failed: ${response.status} - ${errorText}`);
  } else {
    console.log(`[E2E] Webhook sent for ${event}: ${article.title}`);
  }
}

/**
 * Update an article in Strapi via REST API (and re-publish it)
 */
async function updateArticleViaAPI(
  apiToken: string,
  documentId: string,
  updates: { title?: string; description?: string },
): Promise<void> {
  console.log(`[E2E] Updating article via API: ${documentId}`);

  // In Strapi v5, use status=published to update and re-publish
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}?status=published`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ data: updates }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to update article: ${response.status} - ${errorText}`);
  }

  console.log(`[E2E] Article updated and published via API: ${documentId}`);
}

/**
 * Delete an article in Strapi via REST API
 */
async function deleteArticleViaAPI(apiToken: string, documentId: string): Promise<void> {
  console.log(`[E2E] Deleting article via API: ${documentId}`);

  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to delete article: ${response.status} - ${errorText}`);
  }

  console.log(`[E2E] Article deleted via API: ${documentId}`);
}

/**
 * Publish an article in Strapi via REST API (Strapi v5)
 * (kept for future use)
 */
async function _publishArticleViaAPI(apiToken: string, documentId: string): Promise<void> {
  console.log(`[E2E] Publishing article via API: ${documentId}`);

  // Strapi v5 uses /actions/publish endpoint
  const response = await fetch(`${STRAPI_URL}/api/articles/${documentId}/actions/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to publish article: ${response.status} - ${errorText}`);
  }

  console.log(`[E2E] Article published via API: ${documentId}`);
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
      console.log(`[E2E] Article "${articleTitle}" found in consumer app`);
      return;
    }

    console.log(`[E2E] Article "${articleTitle}" not visible yet, retrying...`);
    await sleep(pollIntervalMs);
  }

  throw new Error(`Article "${articleTitle}" did not appear within ${timeoutMs}ms`);
}

/**
 * Configure Strapi webhook via Admin API to notify service app of content changes
 */
async function configureStrapiWebhook(page: Page, webhookUrl: string): Promise<void> {
  console.log(`[E2E] Configuring Strapi webhook: ${webhookUrl}`);

  // Get admin JWT token
  const adminToken = await getStrapiAdminToken();

  // Create webhook via Admin API
  const response = await fetch(`${STRAPI_URL}/admin/webhooks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "E2E Test Webhook",
      url: webhookUrl,
      headers: {},
      events: ["entry.create", "entry.update", "entry.publish", "entry.delete"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to create Strapi webhook: ${response.status} - ${errorText}`);
  }

  const webhookData = await response.json();
  console.log(`[E2E] Strapi webhook configured via API (ID: ${webhookData.data?.id})`);

  // Verify webhook was created correctly
  const verifyResponse = await fetch(`${STRAPI_URL}/admin/webhooks`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const webhooks = await verifyResponse.json();
  console.log(`[E2E] Total webhooks configured: ${webhooks.data?.length || 0}`);
}

/**
 * Setup service app: login/register, create Strapi source, create client
 * Returns API key and sourceId for webhook configuration
 */
async function setupServiceAppAndGetApiKey(
  page: Page,
  strapiApiToken: string,
): Promise<{ apiKey: string; sourceId: string | null; collectionId: string | null }> {
  console.log("[E2E] Setting up service app...");

  // Navigate directly to login page
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Fill login form with existing test credentials
  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login/i }).click();

  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log("[E2E] Logged into service app");

  // Create a Strapi source
  await page.getByRole("link", { name: /Add Source/i }).click();
  await page.waitForURL(/\/sources\/new/);

  await page.getByLabel(/Name/i).fill("E2E Strapi Demo");
  await page.getByLabel(/Strapi URL/i).fill(STRAPI_URL);
  await page.getByLabel(/API Token/i).fill(strapiApiToken);
  await page.getByRole("button", { name: /Create Source/i }).click();

  await page.waitForURL(/\/sources\/\d+/, { timeout: 15000 });

  // Capture source ID from URL for webhook configuration
  const sourceUrl = page.url();
  const sourceIdMatch = sourceUrl.match(/\/sources\/(\d+)/);
  const sourceId = sourceIdMatch ? sourceIdMatch[1] : null;
  console.log(`[E2E] Strapi source created (ID: ${sourceId})`);

  // Configure Strapi webhook to notify service app of content changes
  // Note: sourceId is captured for the webhook URL
  const webhookUrl = sourceId ? `${SERVICE_URL}/webhooks/strapi/${sourceId}` : "";
  console.log(`[E2E] Source ID: ${sourceId}, Webhook URL: ${webhookUrl}`);

  // Create a Collection with implicit SourceCollection creation via UI
  // Navigate to collections/new with sourceId and ref as query params
  // The form has hidden fields that get populated from these params
  console.log("[E2E] Creating collection with linked source collection via UI...");
  await page.goto(`${SERVICE_URL}/collections/new?sourceId=${sourceId}&ref=api::article.article`);
  await page.getByLabel(/Name/i).fill("Articles");
  await page.getByRole("button", { name: /Create Collection/i }).click();
  
  // Wait for redirect to collection detail page
  await page.waitForURL(/\/collections\/\d+/, { timeout: 15000 });
  const collectionUrl = page.url();
  const collectionIdMatch = collectionUrl.match(/\/collections\/(\d+)/);
  const collectionId = collectionIdMatch ? collectionIdMatch[1] : null;
  console.log(`[E2E] Collection created with linked SourceCollection (ID: ${collectionId})`)

  // Create a client for the consumer app
  await page.goto(`${SERVICE_URL}/clients`);
  await page.getByRole("link", { name: /Add Client/i }).click();
  await page.locator('input[name="name"]').fill("E2E Consumer App");
  await page.getByRole("button", { name: /Create Client/i }).click();

  // Wait for client creation
  await page.waitForURL(/\/clients\/\d+/, { timeout: 15000 });
  console.log("[E2E] Client created");

  // Connect client to Articles collection
  // The COLLECTIONS section has a dropdown to select a collection and Add button
  const collectionDropdown = page.locator("select").first();
  if (await collectionDropdown.isVisible().catch(() => false)) {
    await collectionDropdown.selectOption({ label: "Articles" });
    await page.getByRole("button", { name: /^Add$/i }).click();
    await sleep(1000);
    console.log("[E2E] Connected client to Articles collection");
  }

  // Click Regenerate to generate/show the API key
  // The key appears in an Alert with "New API Key" title after form submission
  let apiKey = "";

  // Wait for page to fully hydrate before clicking (ensures JS form enhancement is active)
  await page.waitForLoadState("networkidle");
  await sleep(500); // Extra buffer for Svelte hydration

  const regenerateBtn = page.getByRole("button", { name: /^Regenerate$/i });
  if (await regenerateBtn.isVisible().catch(() => false)) {
    console.log("[E2E] Clicking Regenerate button...");
    
    // Intercept the form response to capture the key directly
    // The Gaudi form system may not be hydrating properly in e2e, so we capture from response
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/clients/") && resp.request().method() === "POST"
    );
    
    await regenerateBtn.click();
    
    const response = await responsePromise;
    console.log(`[E2E] Regenerate response: ${response.status()} ${response.url()}`);
    
    // Try to parse the response body to get the key
    try {
      const responseText = await response.text();
      console.log(`[E2E] Response text length: ${responseText.length}`);
      
      // The response might be JSON with { success: true, key: "..." }
      // Or it might be HTML with the key embedded
      if (responseText.startsWith("{")) {
        const json = JSON.parse(responseText);
        if (json.key) {
          apiKey = json.key;
          console.log(`[E2E] Captured key from JSON response: ${apiKey.slice(0, 8)}...`);
        }
      } else {
        // Try to find the key in HTML response - look for hex string in code element
        const keyMatch = responseText.match(/<code[^>]*>([a-f0-9]{40,})<\/code>/i);
        if (keyMatch) {
          apiKey = keyMatch[1];
          console.log(`[E2E] Captured key from HTML response: ${apiKey.slice(0, 8)}...`);
        }
      }
    } catch (e) {
      console.log(`[E2E] Error parsing response: ${e}`);
    }
    
    // If we still don't have the key, try the UI as fallback
    if (!apiKey) {
      console.log("[E2E] Trying to capture key from UI...");
      await sleep(1000); // Wait for UI to update
      
      const codeElements = page.locator("code");
      const count = await codeElements.count();
      console.log(`[E2E] Found ${count} <code> elements`);
      
      for (let i = 0; i < count; i++) {
        const text = await codeElements.nth(i).textContent();
        if (text && text.length > 30 && /^[a-f0-9]+$/i.test(text.trim())) {
          apiKey = text.trim();
          console.log(`[E2E] Captured key from UI: ${apiKey.slice(0, 8)}...`);
          break;
        }
      }
    }
  }

  if (!apiKey) {
    // Take a screenshot for debugging
    await page.screenshot({ path: "api-key-capture-debug.png" });
    throw new Error("Could not capture API key from service app UI - see api-key-capture-debug.png");
  }

  const trimmedKey = apiKey.trim();
  console.log(
    `[E2E] Captured consumer API key from service app (length: ${trimmedKey.length}, first 8 chars: ${trimmedKey.slice(0, 8)}...)`,
  );

  // Return apiKey, sourceId, and collectionId
  return { apiKey: trimmedKey, sourceId, collectionId };
}

test.describe("E2E: Strapi → Service → Consumer Full Flow", () => {
  // Extend timeout for setup - starting 3 servers + UI automation takes time
  test.describe.configure({ timeout: 300000 }); // 5 minutes

  let strapiApiToken: string;
  let consumerApiKey: string;
  let strapiPage: Page;
  let strapiSourceId: string | null;
  let collectionId: string | null;
  let sourceCollectionId: string | null;
  
  // WebSocket testing: collect events received via WS
  const wsReceivedEvents: ItemEvent[] = [];
  let wsCleanup: (() => void) | null = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    console.log("[E2E] beforeAll starting...");
    
    // Clean up any lingering processes from previous test attempts (e.g., retries)
    await killAllProcesses();
    
    console.log(`[E2E] CI=${process.env.CI}, E2E_FULL_FLOW=${process.env.E2E_FULL_FLOW}, STRAPI_HOST=${process.env.STRAPI_HOST}`);
    
    // Extend timeout for setup - starting 3 servers + UI automation takes time
    // Must be longer than Strapi spawn timeout (180s) + service/consumer startup
    testInfo.setTimeout(300000); // 5 minutes

    // Skip if running in CI without proper setup
    if (process.env.CI && !process.env.E2E_FULL_FLOW) {
      console.log("[E2E] Skipping - E2E_FULL_FLOW not set in CI");
      test.skip();
      return;
    }
    console.log("[E2E] Not skipping, proceeding with setup...");

    // ===== STEP 1: Start Strapi via Docker =====
    // Uses our custom contfu-strapi-test image with pre-configured article content type
    await startStrapiDocker();
    console.log(`[E2E] Waiting for admin init at ${STRAPI_URL}/admin/init...`);
    await waitForUrl(`${STRAPI_URL}/admin/init`, 120000);
    console.log("[E2E] Strapi ready");

    // ===== STEP 2: Start Service app (preview mode) =====
    // Note: Apps must be built first (CI runs `bun run build` before E2E)
    // Note: Using readyUrl instead of stdout pattern because `bun run` writes
    // directly to terminal, bypassing Node.js stdio pipes
    console.log("[E2E] Starting service app (preview mode)...");
    await spawnProcess(
      "bun",
      ["run", "preview", "--", "--port", String(SERVICE_PORT)],
      resolve(PROJECT_ROOT, "packages/service/app"),
      null, // stdout pattern unreliable with bun run
      {
        TEST_MODE: "true",
        DATABASE_URL: ":memory:",
        BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
      },
      60000,
      false,
      SERVICE_URL, // poll this URL for readiness
    );
    console.log("[E2E] Service app ready");

    // ===== STEP 3: Setup Strapi admin via UI =====
    const context = await browser.newContext();
    strapiPage = await context.newPage();

    // Register or login to Strapi admin
    await registerStrapiAdmin(strapiPage);

    // Article content type is pre-configured in our custom Docker image (contfu-strapi-test)
    // No need to create it via API anymore

    // Create Strapi API token via REST API (faster than UI)
    strapiApiToken = await createStrapiApiTokenViaAPI();
    console.log("[E2E] Got Strapi API token via REST API");

    // ===== STEP 4: Setup Service app and get consumer API key =====
    const servicePage = await context.newPage();
    const { apiKey, sourceId, collectionId: capturedCollectionId } = await setupServiceAppAndGetApiKey(servicePage, strapiApiToken);
    collectionId = capturedCollectionId;
    sourceCollectionId = capturedCollectionId; // Same as collectionId since we created one source collection
    consumerApiKey = apiKey;
    strapiSourceId = sourceId;
    await servicePage.close();

    // ===== STEP 4b: Configure Strapi webhook to notify service app =====
    if (sourceId) {
      const webhookUrl = `${SERVICE_URL}/webhooks/strapi/${sourceId}`;
      await configureStrapiWebhook(strapiPage, webhookUrl);
    }

    console.log(`[E2E] Consumer API key captured, sourceId: ${sourceId}`);

    // ===== STEP 5: Start Consumer app with API key =====
    console.log("[E2E] Starting consumer app with API key...");

    // Delete any existing .env file first to avoid stale values
    const envPath = resolve(PROJECT_ROOT, "demos/consumer-app/.env");
    try {
      await fs.unlink(envPath);
      console.log("[E2E] Deleted existing .env file");
    } catch {
      // File doesn't exist, that's fine
    }

    // Write .env file for consumer app (Vite dev server needs this)
    const envContent = `CONTFU_URL=${SERVICE_URL}/api/sse\nCONTFU_KEY=${consumerApiKey}\n`;
    await fs.writeFile(envPath, envContent);
    console.log(
      `[E2E] Wrote .env file: CONTFU_URL=${SERVICE_URL}/api/sse, CONTFU_KEY=${consumerApiKey.slice(0, 8)}...`,
    );

    await spawnProcess(
      "bun",
      ["run", "preview", "--", "--port", String(CONSUMER_PORT)],
      resolve(PROJECT_ROOT, "demos/consumer-app"),
      null, // stdout pattern unreliable with bun run
      {
        CONTFU_URL: `${SERVICE_URL}/api/sse`,
        CONTFU_KEY: consumerApiKey,
      },
      60000,
      false,
      CONSUMER_URL, // poll this URL for readiness
    );
    console.log("[E2E] Consumer app ready");

    // ===== STEP 5b: Connect via WebSocket in parallel =====
    // NOTE: WebSocket testing is disabled in e2e because `vite preview` proxies
    // WS to a dev server that isn't running. WebSocket requires the actual built
    // Bun server (`bun run serve`), but that has CSRF issues with form submissions.
    // TODO: Fix this by either:
    // 1. Disabling CSRF in test mode
    // 2. Running separate server instances for different purposes
    // 3. Testing WebSocket separately with unit/integration tests
    console.log("[E2E] Skipping WebSocket connection (vite preview doesn't support WS properly)...");
    // WebSocket tests are in the dedicated test below
  });

  test.afterAll(async () => {
    // Cleanup WebSocket connection
    if (wsCleanup) {
      console.log("[E2E] Closing WebSocket connection...");
      wsCleanup();
    }
    
    if (strapiPage) {
      await strapiPage.context().close();
    }
    await killAllProcesses();
    
    // Stop Strapi Docker container (unless using external Strapi in CI)
    stopStrapiDocker();
  });

  test("should show Strapi content in consumer app after sync", async ({ page }) => {
    // Skip if running in CI without proper setup
    if (process.env.CI && !process.env.E2E_FULL_FLOW) {
      test.skip();
      return;
    }

    // Open consumer page early to establish SSE connection
    console.log("[E2E] Opening consumer app page...");
    const consumerPage = await page.context().newPage();
    await consumerPage.goto(CONSUMER_URL);
    await consumerPage.waitForLoadState("networkidle");
    console.log("[E2E] Consumer app loaded, SSE connection establishing...");

    // Give SSE connection time to establish
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

    // ===== STEP 5c: Test webhook→SSE flow with a direct webhook =====
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
        description: "Testing webhook→SSE flow",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        publishedAt: new Date().toISOString(),
      },
    };

    try {
      const webhookTestResponse = await fetch(`${SERVICE_URL}/webhooks/strapi/${strapiSourceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testWebhookPayload),
      });
      console.log(`[E2E] Direct webhook test response: ${webhookTestResponse.status}`);
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
        console.log(`[E2E] Test webhook article visible: ${testArticleVisible}`);
      }
    } catch (webhookError) {
      console.error(`[E2E] Webhook test error: ${webhookError}`);
    }

    // ===== STEP 6: Create article via REST API (faster than UI) =====
    const article1 = await createArticleViaAPI(
      strapiApiToken,
      {
        title: "E2E Test Article",
        slug: `e2e-test-article-${Date.now()}`,
        description: "This article was created during e2e testing",
      },
      true,
    ); // true = publish immediately

    // Send webhook manually since Strapi 5 doesn't fire webhooks for Content API operations
    await sendArticleWebhook(Number(strapiSourceId), "entry.create", {
      id: article1.id,
      documentId: article1.documentId,
      title: "E2E Test Article",
      slug: `e2e-test-article-${Date.now()}`,
      description: "This article was created during e2e testing",
    });

    // ===== STEP 7: Verify article in consumer app =====
    // Poll for article to appear (webhook + SSE propagation can take time)
    await waitForArticleInConsumerApp(consumerPage, "E2E Test Article", 30000);

    const articleCount1 = await consumerPage
      .getByText(/Articles: \d+/)
      .textContent()
      .catch(() => "not found");
    console.log(`[E2E] Article count: ${articleCount1}`);

    await expect(
      consumerPage.getByText("This article was created during e2e testing"),
    ).toBeVisible();
    console.log("[E2E] First article visible in consumer app");

    // ===== STEP 8: Create second article via API =====
    const article2Slug = `e2e-second-article-${Date.now()}`;
    const article2 = await createArticleViaAPI(
      strapiApiToken,
      {
        title: "E2E Second Article",
        slug: article2Slug,
        description: "This is the second test article",
      },
      true,
    ); // true = publish immediately

    // Send webhook for second article
    await sendArticleWebhook(Number(strapiSourceId), "entry.create", {
      id: article2.id,
      documentId: article2.documentId,
      title: "E2E Second Article",
      slug: article2Slug,
      description: "This is the second test article",
    });

    // Poll for second article to appear
    await waitForArticleInConsumerApp(consumerPage, "E2E Second Article", 30000);
    console.log("[E2E] Second article visible in consumer app");

    // ===== STEP 9: Update first article via API =====
    await updateArticleViaAPI(strapiApiToken, article1.documentId, {
      title: "E2E Updated Article",
      description: "This article was updated during e2e testing",
    });

    // Send webhook for article update
    await sendArticleWebhook(Number(strapiSourceId), "entry.update", {
      id: article1.id,
      documentId: article1.documentId,
      title: "E2E Updated Article",
      slug: `e2e-test-article-${Date.now()}`,
      description: "This article was updated during e2e testing",
    });
    console.log("[E2E] First article updated via API");

    // Poll for updated article to appear
    await waitForArticleInConsumerApp(consumerPage, "E2E Updated Article", 30000);
    await expect(
      consumerPage.getByText("This article was updated during e2e testing"),
    ).toBeVisible();
    console.log("[E2E] Updated article visible in consumer app");

    // ===== STEP 10: Delete second article via API =====
    await deleteArticleViaAPI(strapiApiToken, article2.documentId);
    console.log("[E2E] Second article deleted via API");

    // Note: Delete event propagation via webhook is TODO - the webhook currently only
    // broadcasts CHANGED events, not DELETED events. For now, just verify the delete
    // API call succeeded (it did if we got here without error).
    // TODO: Implement delete event broadcasting in webhook handler

    // First (updated) article should still be there
    await consumerPage.reload();
    await consumerPage.waitForLoadState("networkidle");
    await expect(consumerPage.getByText("E2E Updated Article")).toBeVisible();
    console.log("[E2E] Test completed - delete propagation is TODO");

    // ===== WebSocket verification skipped =====
    // WebSocket testing is disabled because vite preview doesn't proxy WS properly.
    // See setup comment at "STEP 5b" for details.
    // TODO: Re-enable once we have a proper WS test setup (e.g., bun run serve with CSRF disabled)
    console.log(`[E2E] WebSocket verification skipped (WS connection disabled in vite preview mode)`);
    console.log(`[E2E] wsReceivedEvents.length = ${wsReceivedEvents.length} (expected: 0 since WS is disabled)`);

    await consumerPage.close();
  });

  test("should filter articles based on influx filters", async ({ page }) => {
    // Skip if running in CI without proper setup
    if (process.env.CI && !process.env.E2E_FULL_FLOW) {
      test.skip();
      return;
    }

    // Open consumer page early to establish SSE connection
    console.log("[E2E Filter Test] Opening consumer app page...");
    const consumerPage = await page.context().newPage();
    await consumerPage.goto(CONSUMER_URL);
    await consumerPage.waitForLoadState("networkidle");
    await sleep(2000); // Let SSE connection establish

    // First, update the influx to add a filter
    // Filter: only articles where description contains "IMPORTANT"
    const servicePage = await page.context().newPage();
    console.log(`[E2E Filter Test] Navigating to ${SERVICE_URL}/login`);
    await servicePage.goto(`${SERVICE_URL}/login`);
    console.log(`[E2E Filter Test] Current URL after goto: ${servicePage.url()}`);
    await servicePage.waitForLoadState("networkidle");
    
    // Check if we're on the login page
    const emailField = servicePage.getByLabel(/Email/i);
    const isLoginPage = await emailField.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`[E2E Filter Test] Is login page visible: ${isLoginPage}`);
    
    if (!isLoginPage) {
      // Maybe we're already logged in? Check current URL
      console.log(`[E2E Filter Test] Not on login page. Current URL: ${servicePage.url()}`);
      await servicePage.screenshot({ path: "debug-filter-test-login.png" });
      
      // If already on dashboard, skip login
      if (servicePage.url().includes("/dashboard")) {
        console.log("[E2E Filter Test] Already on dashboard, skipping login");
      } else {
        throw new Error(`Unexpected page state. URL: ${servicePage.url()}`);
      }
    } else {
      await emailField.fill(TEST_USER.email);
      await servicePage.getByLabel(/Password/i).fill(TEST_USER.password);
      await servicePage.getByRole("button", { name: /Sign in|Log in|Login/i }).click();
      console.log("[E2E Filter Test] Clicked login, waiting for dashboard...");
      await servicePage.waitForURL(/\/dashboard/, { timeout: 15000 });
    }
    console.log(`[E2E Filter Test] Login complete, current URL: ${servicePage.url()}`);

    // Navigate to the collection and configure filters (using dynamic ID)
    if (!collectionId) {
      throw new Error("collectionId not set - beforeAll may not have run");
    }
    await servicePage.goto(`${SERVICE_URL}/collections/${collectionId}`);
    await servicePage.waitForLoadState("networkidle");

    // Find and click edit filters button (if it exists in the UI)
    // For now, we'll use the API directly to set filters
    console.log("[E2E Filter Test] Setting up filter via API...");

    // Update the influx filter via the service API using form submission
    // The updateSourceCollectionMapping form action accepts filters as JSON string
    // FilterOperator.CONTAINS = 7 (numeric enum from @contfu/core)
    const filterPayload = JSON.stringify([
      { property: "description", operator: 7, value: "IMPORTANT" },
    ]);

    // Use the form action endpoint with dynamic IDs from the setup
    // Origin header is required for SvelteKit form actions in production/preview mode
    if (!collectionId || !sourceCollectionId) {
      throw new Error("collectionId or sourceCollectionId not set from beforeAll setup");
    }
    console.log(`[E2E Filter Test] Using collectionId: ${collectionId}, sourceCollectionId: ${sourceCollectionId}`);
    
    const filterResponse = await fetch(`${SERVICE_URL}/collections/${collectionId}?/updateSourceCollectionMapping`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Origin: SERVICE_URL,
        Cookie: await servicePage.context().cookies().then(cookies => 
          cookies.map(c => `${c.name}=${c.value}`).join("; ")
        ),
      },
      body: new URLSearchParams({
        collectionId: collectionId,
        sourceCollectionId: sourceCollectionId,
        filters: filterPayload,
      }),
    });
    console.log(`[E2E Filter Test] Filter update response: ${filterResponse.status}`);
    if (!filterResponse.ok) {
      const errorText = await filterResponse.text();
      console.log(`[E2E Filter Test] Filter update FAILED: ${errorText}`);
      throw new Error(`Filter update failed: ${filterResponse.status} - ${errorText}`);
    }
    await servicePage.close();

    // Wait for filter to propagate
    await sleep(1000);

    // Create articles - some matching filter, some not
    const timestamp = Date.now();

    // Article 1: SHOULD match filter (description contains "IMPORTANT")
    const matchingArticle = await createArticleViaAPI(
      strapiApiToken,
      {
        title: "Matching Filter Article",
        slug: `matching-filter-${timestamp}`,
        description: "This is an IMPORTANT article that should pass the filter",
      },
      true,
    );

    // Article 2: Should NOT match filter (no "IMPORTANT" in description)
    const nonMatchingArticle = await createArticleViaAPI(
      strapiApiToken,
      {
        title: "Non-Matching Article",
        slug: `non-matching-${timestamp}`,
        description: "This is a regular article without the keyword",
      },
      true,
    );

    // Send webhooks for both articles
    await sendArticleWebhook(Number(strapiSourceId), "entry.create", {
      id: matchingArticle.id,
      documentId: matchingArticle.documentId,
      title: "Matching Filter Article",
      slug: `matching-filter-${timestamp}`,
      description: "This is an IMPORTANT article that should pass the filter",
    });

    await sendArticleWebhook(Number(strapiSourceId), "entry.create", {
      id: nonMatchingArticle.id,
      documentId: nonMatchingArticle.documentId,
      title: "Non-Matching Article",
      slug: `non-matching-${timestamp}`,
      description: "This is a regular article without the keyword",
    });

    // Wait for potential sync
    await sleep(3000);
    await consumerPage.reload();
    await consumerPage.waitForLoadState("networkidle");

    // Verify: matching article should appear
    const matchingVisible = await consumerPage
      .getByText("Matching Filter Article")
      .isVisible()
      .catch(() => false);

    // Verify: non-matching article should NOT appear
    const nonMatchingVisible = await consumerPage
      .getByText("Non-Matching Article")
      .isVisible()
      .catch(() => false);

    console.log(`[E2E Filter Test] Matching article visible: ${matchingVisible}`);
    console.log(`[E2E Filter Test] Non-matching article visible: ${nonMatchingVisible}`);

    // Assert filter works correctly
    expect(matchingVisible).toBe(true);
    expect(nonMatchingVisible).toBe(false);

    console.log("[E2E Filter Test] Filter test passed!");

    // Clean up: remove filters for subsequent tests
    // (Leave this for now as subsequent tests may need clean state)

    await consumerPage.close();
  });

  // TODO: Re-enable once WebSocket live-updates from Strapi are fully implemented
  // This test verifies real-time content updates appear in the consumer app without page reload
  test.skip("should receive real-time updates via WebSocket", async ({ page }) => {
    // Open consumer app
    await page.goto(CONSUMER_URL);
    await page.waitForLoadState("networkidle");

    // Verify WebSocket connection status indicator (if present)
    const connectionStatus = page.getByTestId("connection-status");
    if (await connectionStatus.isVisible().catch(() => false)) {
      await expect(connectionStatus).toHaveText(/connected/i);
    }

    // Create a new article in Strapi VIA THE ADMIN UI
    await createArticleViaUI(strapiPage, {
      title: "Realtime Test Article",
      slug: "realtime-test-article",
      description: "Testing real-time sync",
    });

    // Bring consumer page to front and wait for real-time update
    await page.bringToFront();

    // Wait for real-time update to appear (no page reload needed)
    await expect(page.getByText("Realtime Test Article")).toBeVisible({ timeout: 30000 });
    console.log("[E2E] Real-time update received in consumer app");

    // Verify the article content
    await expect(page.getByText("Testing real-time sync")).toBeVisible();
  });
});

/**
 * Configuration for the e2e tests
 */
test.describe.configure({ mode: "serial" });
