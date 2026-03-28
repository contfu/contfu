import { defineConfig, devices } from "@playwright/test";

const TEST_PORT = 4173;
const MOCK_NOTION_PORT = 4174;
const MOCK_STRAPI_PORT = 4175;
const NATS_PORT = 4222;
const NATS_MONITOR_PORT = 8222;

// Use /tmp for PGlite data so it stays inside the Docker container
// and doesn't pollute the mounted source tree.
const PGLITE_DATA_DIR = "/tmp/contfu-e2e-pglite";

// Make PGLITE_DATA_DIR available to globalSetup (runs in the same process)
process.env.PGLITE_DATA_DIR = PGLITE_DATA_DIR;

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
      command: `nats-server --jetstream --store_dir /tmp/nats-e2e -p ${NATS_PORT} -m ${NATS_MONITOR_PORT}`,
      url: `http://localhost:${NATS_MONITOR_PORT}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
    },
    {
      command: `bun tests/mock-notion-server.ts`,
      url: `http://localhost:${MOCK_NOTION_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { PORT: String(MOCK_NOTION_PORT) },
    },
    {
      command: `bun tests/mock-strapi-server.ts`,
      url: `http://localhost:${MOCK_STRAPI_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "pipe",
      stderr: "pipe",
      env: { PORT: String(MOCK_STRAPI_PORT) },
    },
    {
      // Production build — required for Bun WebSocket handler in hooks.server.ts.
      // Vite dev mode uses its own HTTP server which doesn't support Bun.ServerWebSocket.
      // NODE_ENV=test is needed at build time for CSRF config and at runtime for test user creation.
      command: `NODE_ENV=test NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} bun run build && NODE_ENV=test NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} PORT=${TEST_PORT} bun run serve`,
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ORIGIN: `http://localhost:${TEST_PORT}`,
        VITE_BETTER_AUTH_URL: `http://localhost:${TEST_PORT}`,
        PGLITE_DATA_DIR,
        NATS_SERVER: `nats://localhost:${NATS_PORT}`,
      },
    },
  ],
});
