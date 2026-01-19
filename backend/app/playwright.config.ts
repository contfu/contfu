import { defineConfig, devices } from "@playwright/test";

// Use a different port for E2E tests to avoid conflicts with other services
const TEST_PORT = 4173;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Run tests sequentially for auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for consistent auth state
  reporter: "html",
  timeout: 60000,
  use: {
    baseURL: `http://localhost:${TEST_PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Build and serve production build - this runs on Bun runtime with real database
    // vite dev runs in Node.js which can't use Bun-specific modules like SQL from "bun"
    // TEST_MODE is needed at build time for CSRF config and at runtime for test user creation
    command: `TEST_MODE=true bun run build && TEST_MODE=true PORT=${TEST_PORT} bun run serve`,
    url: `http://localhost:${TEST_PORT}`,
    reuseExistingServer: false, // Always start fresh server to avoid port conflicts
    timeout: 180000, // Allow time for build + server startup
  },
});
