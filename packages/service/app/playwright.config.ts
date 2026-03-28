import { defineConfig, devices } from "@playwright/test";

const TEST_PORT = 4173;
const MOCK_NOTION_PORT = 4174;
const MOCK_STRAPI_PORT = 4175;
const NATS_PORT = 4222;
const NATS_MONITOR_PORT = 8222;

// Use /tmp for PGlite data so it stays inside the Docker container
// and doesn't pollute the mounted source tree.
const PGLITE_DATA_DIR = "/tmp/contfu-e2e-pglite";

// In CI the NATS service container is already running; accept it via env var
// so playwright doesn't try to start a second nats-server on the same port.
const NATS_SERVER = process.env.NATS_SERVER ?? `nats://localhost:${NATS_PORT}`;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
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
    // Start NATS locally only; in CI the service container is used via NATS_SERVER env var.
    ...(process.env.NATS_SERVER
      ? []
      : [
          {
            command: `nats-server --jetstream --store_dir /tmp/nats-e2e -p ${NATS_PORT} -m ${NATS_MONITOR_PORT}`,
            url: `http://localhost:${NATS_MONITOR_PORT}/healthz`,
            reuseExistingServer: !process.env.CI,
            timeout: 10_000,
            stdout: "ignore" as const,
            stderr: "ignore" as const,
          },
        ]),
    {
      command: `bun tests/mock-notion-server.ts`,
      url: `http://localhost:${MOCK_NOTION_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "ignore",
      stderr: "ignore",
      env: { PORT: String(MOCK_NOTION_PORT) },
    },
    {
      command: `bun tests/mock-strapi-server.ts`,
      url: `http://localhost:${MOCK_STRAPI_PORT}`,
      reuseExistingServer: false,
      timeout: 10_000,
      stdout: "ignore",
      stderr: "ignore",
      env: { PORT: String(MOCK_STRAPI_PORT) },
    },
    {
      // Build the app, then seed + serve in a single process.
      // Seeding happens before the server opens the DB, so the test data is
      // available from the first request. This avoids the race condition where
      // Playwright's globalSetup runs AFTER webServers are already started.
      // Set SKIP_BUILD=true (e.g. in CI where the app is already built) to skip
      // the SvelteKit build step and go straight to seed-and-serve.
      command:
        process.env.SKIP_BUILD === "true"
          ? `NODE_ENV=test NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} PGLITE_DATA_DIR=${PGLITE_DATA_DIR} NATS_SERVER=${NATS_SERVER} BETTER_AUTH_SECRET=e2e-test-secret-at-least-32-chars-long MIN_FETCH_INTERVAL=2000 PORT=${TEST_PORT} bun tests/seed-and-serve.ts`
          : `NODE_ENV=test NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} bun run build && NODE_ENV=test NOTION_BASE_URL=http://localhost:${MOCK_NOTION_PORT} PGLITE_DATA_DIR=${PGLITE_DATA_DIR} NATS_SERVER=${NATS_SERVER} BETTER_AUTH_SECRET=e2e-test-secret-at-least-32-chars-long MIN_FETCH_INTERVAL=2000 PORT=${TEST_PORT} bun tests/seed-and-serve.ts`,
      url: `http://localhost:${TEST_PORT}`,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: "ignore",
      stderr: "ignore",
    },
  ],
});
