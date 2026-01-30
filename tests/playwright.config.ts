import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for full e2e tests.
 *
 * These tests launch real servers (Strapi, Service App, Consumer App)
 * and test the complete integration flow.
 *
 * Run with: bun test:e2e
 * Or: npx playwright test -c tests/e2e/playwright.config.ts
 *
 * Note: By default, these tests are skipped in CI.
 * Set E2E_FULL_FLOW=true to run them.
 */
export default defineConfig({
  testDir: ".",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false, // Must run sequentially - servers are shared
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Single worker - tests share server state
  reporter: [["html", { outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  timeout: 180_000, // 3 minutes per test - servers take time
  globalTimeout: 600_000, // 10 minutes total for all tests
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // No webServer config - tests spawn their own servers
});
