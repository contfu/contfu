/**
 * E2E Playwright tests for reactive list updates.
 *
 * Tests that lists update immediately after add/remove/edit operations
 * without requiring page refresh (using SvelteKit remote function auto-refresh).
 */
import { expect, test, type Page } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

const SERVICE_PORT = 8012; // Different port to avoid conflicts
const SERVICE_URL = `http://localhost:${SERVICE_PORT}`;

const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

const processes: ChildProcess[] = [];

async function spawnProcess(
  command: string,
  args: string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
  timeoutMs = 60000,
  readyUrl?: string,
): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Process did not become ready within ${timeoutMs}ms`));
    }, timeoutMs);

    const proc = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: ["pipe", "pipe", "pipe"],
      shell: true,
    });

    processes.push(proc);
    let isReady = false;

    const markReady = () => {
      if (!isReady) {
        isReady = true;
        clearTimeout(timeout);
        resolve(proc);
      }
    };

    proc.stdout?.on("data", (data) => {
      if (process.env.CI) process.stdout.write(`[service] ${data}`);
    });
    proc.stderr?.on("data", (data) => {
      if (process.env.CI) process.stderr.write(`[service] ${data}`);
    });

    proc.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    if (readyUrl) {
      const pollUrl = async () => {
        const pollStart = Date.now();
        while (Date.now() - pollStart < timeoutMs && !isReady) {
          try {
            const response = await fetch(readyUrl);
            if (response.ok || response.status === 404 || response.status === 500) {
              markReady();
              return;
            }
          } catch {
            // Server not ready
          }
          await sleep(500);
        }
      };
      void pollUrl();
    }
  });
}

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

async function login(page: Page): Promise<void> {
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Check if already logged in
  if (!page.url().includes("/login")) return;

  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

test.describe("Reactive List Updates", () => {
  test.describe.configure({ timeout: 120000 });

  test.beforeAll(async () => {
    await killAllProcesses();

    // Start service app
    await spawnProcess(
      "bun",
      ["build/index.js"],
      resolve(PROJECT_ROOT, "packages/service/app"),
      {
        PORT: String(SERVICE_PORT),
        ORIGIN: SERVICE_URL,
        TEST_MODE: "true",
        DATABASE_URL: ":memory:",
        BETTER_AUTH_SECRET: "e2e-test-secret-at-least-32-chars-long",
      },
      60000,
      SERVICE_URL,
    );
  });

  test.afterAll(async () => {
    await killAllProcesses();
  });

  test("consumers list updates after delete without page refresh", async ({ page }) => {
    await login(page);

    // Create a consumer
    await page.goto(`${SERVICE_URL}/consumers/new`);
    await page.locator('input[name="name"]').fill("Test Consumer for Delete");
    await page.getByRole("button", { name: /Create Consumer/i }).click();
    await page.waitForURL(/\/consumers\/\d+/);

    // Go to consumers list
    await page.goto(`${SERVICE_URL}/consumers`);
    await page.waitForLoadState("networkidle");

    // Verify consumer is in list
    await expect(page.getByText("Test Consumer for Delete")).toBeVisible();

    // Count consumers before delete
    const rowsBefore = await page.locator("tbody tr").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Set up dialog handler BEFORE clicking
    page.on("dialog", (dialog) => dialog.accept());

    // Delete the consumer
    const deleteButton = page
      .locator("tr", { hasText: "Test Consumer for Delete" })
      .getByRole("button", { name: /Delete/i });
    await deleteButton.click();

    // Wait for the row to disappear (form auto-refreshes queries)
    await expect(page.getByText("Test Consumer for Delete")).not.toBeVisible({ timeout: 5000 });

    // Verify row count decreased
    const rowsAfter = await page.locator("tbody tr").count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  test("sources list updates after delete without page refresh", async ({ page }) => {
    await login(page);

    // Create a source (Web type - doesn't require external service)
    await page.goto(`${SERVICE_URL}/sources/new`);
    await page.getByLabel(/Name/i).fill("Test Source for Delete");

    // Select Web source type using the custom Select component
    await page.getByLabel(/Type/i).click();
    await page.getByRole("option", { name: /Web/i }).click();

    // Fill Base URL
    await page.getByLabel(/Base URL/i).fill("https://example.com");

    await page.getByRole("button", { name: /Create Source/i }).click();
    await page.waitForURL(/\/sources\/\d+/, { timeout: 10000 });

    // Go to sources list
    await page.goto(`${SERVICE_URL}/sources`);
    await page.waitForLoadState("networkidle");

    // Verify source is in list
    await expect(page.getByText("Test Source for Delete")).toBeVisible();

    // Count sources before delete
    const rowsBefore = await page.locator("tbody tr").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Set up dialog handler BEFORE clicking
    page.on("dialog", (dialog) => dialog.accept());

    // Delete the source
    const deleteButton = page
      .locator("tr", { hasText: "Test Source for Delete" })
      .getByRole("button", { name: /Delete/i });
    await deleteButton.click();

    // Wait for the row to disappear
    await expect(page.getByText("Test Source for Delete")).not.toBeVisible({ timeout: 5000 });

    // Verify row count decreased
    const rowsAfter = await page.locator("tbody tr").count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });

  test("consumer connections update after add/remove without page refresh", async ({ page }) => {
    await login(page);

    // Create a collection first
    await page.goto(`${SERVICE_URL}/collections/new`);
    await page.getByLabel(/Name/i).fill("Test Collection for Connections");
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/\d+/);

    // Create a consumer
    await page.goto(`${SERVICE_URL}/consumers/new`);
    await page.locator('input[name="name"]').fill("Test Consumer for Connections");
    await page.getByRole("button", { name: /Create Consumer/i }).click();
    await page.waitForURL(/\/consumers\/\d+/);

    // Verify no connections initially
    await expect(page.getByText("No collections connected")).toBeVisible();

    // Add connection to collection
    const collectionDropdown = page.locator("select").first();
    await collectionDropdown.selectOption({ label: "Test Collection for Connections" });
    await page.getByRole("button", { name: /^Add$/i }).click();

    // Verify connection appears WITHOUT page refresh (use specific locator to avoid matching <option> elements)
    await expect(
      page
        .locator("div.flex")
        .filter({ hasText: "Test Collection for Connections" })
        .getByText("Remove"),
    ).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("No collections connected")).not.toBeVisible();

    // Remove the connection
    await page
      .locator("div.flex")
      .filter({ hasText: "Test Collection for Connections" })
      .getByText("Remove")
      .click();

    // Verify connection removed WITHOUT page refresh
    await expect(page.getByText("No collections connected")).toBeVisible({ timeout: 5000 });
  });

  test("collection connections update after add/remove without page refresh", async ({ page }) => {
    await login(page);

    // Create a consumer first
    await page.goto(`${SERVICE_URL}/consumers/new`);
    await page.locator('input[name="name"]').fill("Consumer for Collection Test");
    await page.getByRole("button", { name: /Create Consumer/i }).click();
    await page.waitForURL(/\/consumers\/\d+/);

    // Create a collection
    await page.goto(`${SERVICE_URL}/collections/new`);
    await page.getByLabel(/Name/i).fill("Collection for Connection Test");
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/\d+/);

    // Verify no consumers initially
    await expect(page.getByText("No consumers linked yet")).toBeVisible();

    // Add consumer connection via combobox
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /Consumer for Collection Test/i }).click();
    await page.getByRole("button", { name: /Link Consumer/i }).click();

    // Verify consumer appears WITHOUT page refresh
    await expect(page.getByRole("link", { name: "Consumer for Collection Test" })).toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("No consumers linked yet")).not.toBeVisible();

    // Remove the connection (button is icon-only, no text)
    await page
      .locator("div.rounded-md.border")
      .filter({ has: page.getByRole("link", { name: "Consumer for Collection Test" }) })
      .locator('button[type="submit"]')
      .click();

    // Verify connection removed WITHOUT page refresh
    await expect(page.getByText("No consumers linked yet")).toBeVisible({ timeout: 5000 });
  });

  test("source collections list updates after delete without page refresh", async ({ page }) => {
    await login(page);

    // Create a Web source with a source collection
    await page.goto(`${SERVICE_URL}/sources/new`);
    await page.waitForLoadState("networkidle");
    await page.getByLabel(/Name/i).fill("Source for Collection Delete");

    // Select Web source type using the custom Select component
    await page.getByLabel(/Type/i).click();
    await page.getByRole("option", { name: /Web/i }).click();

    await page.getByLabel(/Base URL/i).fill("https://example.com");
    await page.getByRole("button", { name: /Create Source/i }).click();
    await page.waitForURL(/\/sources\/\d+/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // Add a source collection via the form
    await page.getByLabel(/Path or URL/i).fill("/api/test-endpoint");
    await page.getByLabel(/Collection Name/i).fill("Test Endpoint Collection");
    await page.getByRole("button", { name: /Add Source Collection/i }).click();

    // Wait for form submission to complete (header updates collection count)
    await expect(page.getByText(/1 collection/)).toBeVisible({ timeout: 10000 });

    // Navigate to source collections page
    const sourceUrl = page.url();
    const sourceId = sourceUrl.match(/\/sources\/(\d+)/)?.[1];
    await page.goto(`${SERVICE_URL}/sources/${sourceId}/collections`);
    await page.waitForLoadState("networkidle");

    // Verify collection is listed
    await expect(page.getByText("Test Endpoint Collection")).toBeVisible();
    const rowsBefore = await page.locator("tbody tr").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Set up dialog handler BEFORE clicking
    page.on("dialog", (dialog) => dialog.accept());

    // Delete the source collection
    const removeButton = page
      .locator("tr", { hasText: "Test Endpoint Collection" })
      .getByRole("button", { name: /Remove/i });
    await removeButton.click();

    // Wait for the row to disappear
    await expect(page.getByText("Test Endpoint Collection")).not.toBeVisible({ timeout: 5000 });

    // Verify row count decreased
    const rowsAfter = await page.locator("tbody tr").count();
    expect(rowsAfter).toBeLessThan(rowsBefore);
  });
});

test.describe.configure({ mode: "serial" });
