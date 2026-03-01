import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// Use a different port for E2E tests to avoid conflicts with other services
const TEST_PORT = 4173;
const MOCK_NOTION_PORT = 4174;
const MOCK_STRAPI_PORT = 4175;
const DIRNAME = path.dirname(fileURLToPath(import.meta.url));

// File-based PGlite database shared between globalSetup (seeding) and the server
const PGLITE_DATA_DIR = path.join(DIRNAME, "tests/.pglite-e2e");

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false, // Run tests sequentially for auth state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Single worker for consistent auth state
  reporter: "html",
  timeout: 5_000,
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
  webServer: [
    {
      command: `bun tests/mock-notion-server.ts`,
      url: `http://localhost:${MOCK_NOTION_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `bun tests/mock-strapi-server.ts`,
      url: `http://localhost:${MOCK_STRAPI_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      // Build and serve production build - this runs on Bun runtime with real database
      // vite dev runs in Node.js which can't use Bun-specific modules like SQL from "bun"
      // TEST_MODE is needed at build time for CSRF config and at runtime for test user creation
      command: `TEST_MODE=true NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} bun run build && TEST_MODE=true NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} PORT=${TEST_PORT} bun run serve`,
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false, // Always start fresh server to avoid port conflicts
      timeout: 180_000, // Allow time for build + server startup,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ORIGIN: `http://localhost:${TEST_PORT}`,
        VITE_BETTER_AUTH_URL: `http://localhost:${TEST_PORT}`,
        PGLITE_DATA_DIR,
      },
    },
  ],
});
