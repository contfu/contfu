/**
 * E2E Playwright tests for reactive list updates.
 *
 * Tests that lists update immediately after add/remove/edit operations
 * without requiring page refresh (using SvelteKit remote function auto-refresh).
 *
 * Uses the shared service app started by global-setup.ts.
 */
import { expect, test, type Page } from "@playwright/test";

const SERVICE_URL = process.env.E2E_SERVICE_URL || "http://localhost:8011";

const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

// Unique suffix per test run to avoid collisions on retry
const RUN_ID = Date.now().toString(36);

async function login(page: Page): Promise<void> {
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");

  // Check if already logged in
  if (!page.url().includes("/login")) return;

  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login|Authenticate/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe("Reactive List Updates", () => {
  test.describe.configure({ timeout: 60000 });

  test("collections list updates after create and delete without page refresh", async ({
    page,
  }) => {
    await login(page);

    // Create a collection
    await page.goto(`${SERVICE_URL}/collections/new`);
    await page.getByLabel(/Display Name/i).fill(`Delete Col ${RUN_ID}`);
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/[a-zA-Z0-9]+/);

    // Go to collections list
    await page.goto(`${SERVICE_URL}/collections`);
    await page.waitForLoadState("networkidle");

    // Verify collection is in list
    await expect(page.getByText(`Delete Col ${RUN_ID}`)).toBeVisible();

    // Count collections before delete
    const rowsBefore = await page.locator("tbody tr").count();
    expect(rowsBefore).toBeGreaterThan(0);

    // Navigate to the collection detail page to delete it
    await page.getByText(`Delete Col ${RUN_ID}`).click();
    await page.waitForURL(/\/collections\/[a-zA-Z0-9]+/);

    // Click delete in the danger zone
    await page.getByRole("button", { name: /Delete Collection/i }).click();

    // Wait for delete to complete (the enhance callback calls goto("/collections"))
    await page.waitForURL(/\/collections$/, { timeout: 10000 });

    // Force a fresh navigation to the collections list to ensure clean state
    await page.goto(`${SERVICE_URL}/collections`);
    await page.waitForLoadState("networkidle");

    // Verify collection is no longer in list
    await expect(page.getByText(`Delete Col ${RUN_ID}`)).not.toBeVisible({ timeout: 5000 });
  });

  test("collection detail: target flow updates after add/remove without page refresh", async ({
    page,
  }) => {
    await login(page);

    // Create two collections
    await page.goto(`${SERVICE_URL}/collections/new`);
    await page.getByLabel(/Display Name/i).fill(`Source Flow Col ${RUN_ID}`);
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/[a-zA-Z0-9]+/);

    await page.goto(`${SERVICE_URL}/collections/new`);
    await page.getByLabel(/Display Name/i).fill(`Target Flow Col ${RUN_ID}`);
    await page.getByRole("button", { name: /Create Collection/i }).click();
    await page.waitForURL(/\/collections\/[a-zA-Z0-9]+/);

    // We're on the target collection detail page.
    // Go to the source collection to add a target flow to the target collection.
    await page.goto(`${SERVICE_URL}/collections`);
    await page.waitForLoadState("networkidle");
    await page.getByText(`Source Flow Col ${RUN_ID}`).click();
    await page.waitForURL(/\/collections\/[a-zA-Z0-9]+/);

    // Verify no outflows initially
    await expect(page.getByText("No outflows configured yet.")).toBeVisible();

    // Add outflow via the select in the "Outflows" section
    const outflowSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: /Outflows/i }) });

    await outflowSection.locator("[data-select-trigger]").click();
    await page.getByRole("option", { name: new RegExp(`Target Flow Col ${RUN_ID}`, "i") }).click();
    await outflowSection.getByRole("button", { name: /Add Outflow/i }).click();

    // Verify flow appears WITHOUT page refresh
    await expect(page.getByRole("link", { name: `Target Flow Col ${RUN_ID}` })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("No outflows configured yet.")).not.toBeVisible();
  });
});

test.describe.configure({ mode: "serial" });
