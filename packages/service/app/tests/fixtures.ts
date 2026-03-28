import { test as base, expect, type Page } from "@playwright/test";

// Test user credentials (auto-created in dev mode by login function)
export const TEST_USER = {
  email: "test@test.com",
  password: "test",
};

// Helper to perform login using actual form submission
async function performLogin(page: Page): Promise<boolean> {
  // Navigate to login page — wait for networkidle so Svelte hydration completes
  // (dev mode compiles on-demand, so domcontentloaded is too early)
  await page.goto("/login");
  await page.waitForLoadState("networkidle");

  // Fill in the login form
  await page.fill('input[name="email"], input[type="email"]', TEST_USER.email);
  await page.fill('input[name="password"], input[type="password"]', TEST_USER.password);

  // Submit the form and wait for redirect
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 15_000 }),
    page.click('button[type="submit"]'),
  ]);

  // Check if we're now on dashboard or still on login
  const currentUrl = page.url();

  // Check for session cookie
  const cookies = await page.context().cookies();
  const hasSession = cookies.some((c) => c.name === "s");

  // Success if we're not on login page and have session
  return !currentUrl.includes("/login") && hasSession;
}

// Extended test with authentication fixture
export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Try to access dashboard first
    await page.goto("/dashboard");

    // If we're on login page, we need to authenticate
    if (page.url().includes("/login")) {
      const loginSuccess = await performLogin(page);

      if (!loginSuccess) {
        // Take debug screenshot
        await page.screenshot({ path: "test-results/login-debug.png" });
        console.log("Login failed. Current URL:", page.url());
        throw new Error("Login failed - check test-results/login-debug.png for details");
      }
    }

    // Verify we're authenticated
    await expect(page).not.toHaveURL(/\/login/);

    await use(page);
  },
});

export { expect };
