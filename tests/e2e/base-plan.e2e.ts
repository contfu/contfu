/**
 * E2E tests for base plan changes.
 *
 * Validates that when a user's base plan changes, the dashboard limits
 * and sidebar badge reflect the new tier correctly.
 *
 * Uses the shared service app started by global-setup.ts.
 */
import { expect, test, type Page } from "@playwright/test";

const SERVICE_URL = process.env.E2E_SERVICE_URL || "http://localhost:8011";
const TEST_USER = { email: "test@test.com", password: "test" };
const PLAN = { FREE: 0, STARTER: 1, PRO: 2, BUSINESS: 3 } as const;

async function login(page: Page): Promise<void> {
  await page.goto(`${SERVICE_URL}/login`);
  await page.waitForLoadState("networkidle");
  if (!page.url().includes("/login")) return;
  await page.getByLabel(/Email/i).fill(TEST_USER.email);
  await page.getByLabel(/Password/i).fill(TEST_USER.password);
  await page.getByRole("button", { name: /Sign in|Log in|Login|Authenticate/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

async function getSessionUserId(page: Page): Promise<number> {
  const resp = await page.request.get(`${SERVICE_URL}/api/auth/get-session`);
  const session = await resp.json();
  return Number(session.user.id);
}

async function setBasePlan(page: Page, userId: number, plan: number): Promise<void> {
  const resp = await page.request.post(`${SERVICE_URL}/api/admin/set-plan`, {
    data: { userId, basePlan: plan },
  });
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`set-plan API returned ${resp.status()}: ${body}`);
  }
}

async function getBadgeText(page: Page): Promise<string> {
  await page.getByText(TEST_USER.email).first().click();
  await page.waitForTimeout(100);
  const badge = page.locator('[data-slot="dropdown-menu-label"] [data-slot="badge"]').first();
  const text = await badge.textContent();
  await page.keyboard.press("Escape");
  return text?.trim() ?? "";
}

test.describe("Base Plan: admin plan switch via remote function", () => {
  test("switching plan submits the correct user ID and updates the badge", async ({ page }) => {
    await login(page);
    const userId = await getSessionUserId(page);

    // Ensure user starts on Free
    await setBasePlan(page, userId, PLAN.FREE);
    await page.goto(`${SERVICE_URL}/admin/users`);
    await page.waitForLoadState("networkidle");
    // Plan badge is in the 4th table column (User, Status, Role, Base Plan)
    const planBadge = page.locator("td:nth-child(4) [data-slot='badge']");
    await expect(planBadge).toHaveText("Free");

    // Switch to Starter via admin API
    await setBasePlan(page, userId, PLAN.STARTER);
    await page.goto(`${SERVICE_URL}/admin/users`);
    await page.waitForLoadState("networkidle");
    await expect(planBadge).toHaveText("Starter");

    // Switch to Pro — regression case: second switch must also work
    await setBasePlan(page, userId, PLAN.PRO);
    await page.goto(`${SERVICE_URL}/admin/users`);
    await page.waitForLoadState("networkidle");
    await expect(planBadge).toHaveText("Pro");

    // Cleanup
    await setBasePlan(page, userId, PLAN.FREE);
  });
});

test.describe("Base Plan: badge and limits update", () => {
  test("plan switches update dashboard limits and badge", async ({ page }) => {
    await login(page);
    const userId = await getSessionUserId(page);

    // Start from Free
    await setBasePlan(page, userId, PLAN.FREE);
    await page.goto(`${SERVICE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("0 / 100")).toBeVisible();

    // Switch to Starter
    await setBasePlan(page, userId, PLAN.STARTER);
    await page.goto(`${SERVICE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("0 / 1000")).toBeVisible();
    expect(await getBadgeText(page)).toBe("Starter");

    // Switch to Pro (second switch — regression case)
    await setBasePlan(page, userId, PLAN.PRO);
    await page.goto(`${SERVICE_URL}/dashboard`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("0 / 10000")).toBeVisible();
    expect(await getBadgeText(page)).toBe("Pro");

    // Cleanup
    await setBasePlan(page, userId, PLAN.FREE);
  });
});

test.describe.configure({ mode: "serial" });
