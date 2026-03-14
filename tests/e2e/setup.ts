/**
 * E2E Test Setup Script
 *
 * DEPRECATED: Strapi startup functions are deprecated in favor of using
 * captured webhook fixtures for E2E tests.
 *
 * These functions are kept for:
 * 1. Running the fixture capture script (tests/e2e/scripts/capture-strapi-fixtures.ts)
 * 2. Any future tests that require real Strapi
 *
 * For normal E2E test runs, Strapi is no longer started automatically.
 *
 * ---
 *
 * Original documentation:
 *
 * Prepares the environment for E2E tests.
 *
 * Strapi runs via Docker using the published test image.
 * with a pre-configured article content type.
 *
 * Run automatically before tests or manually: bun tests/e2e/setup.ts
 */
import { execSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const STRAPI_PORT = process.env.STRAPI_PORT || "1337";
const STRAPI_CONTAINER_NAME = "contfu-e2e-strapi";

/**
 * Check if Docker is available
 */
function isDockerAvailable(): boolean {
  try {
    execSync("docker info", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the Strapi container is already running
 */
function isStrapiContainerRunning(): boolean {
  try {
    const result = execSync(
      `docker inspect -f '{{.State.Running}}' ${STRAPI_CONTAINER_NAME} 2>/dev/null`,
      {
        encoding: "utf-8",
      },
    );
    return result.trim() === "true";
  } catch {
    return false;
  }
}

/**
 * Stop and remove any existing Strapi container
 */
function cleanupStrapiContainer(): void {
  try {
    execSync(`docker rm -f ${STRAPI_CONTAINER_NAME} 2>/dev/null`, { stdio: "ignore" });
  } catch {
    // Container doesn't exist, that's fine
  }
}

/**
 * Wait for Strapi to be ready
 */
async function waitForStrapi(host: string, port: string, timeoutMs = 120000): Promise<void> {
  const url = `http://${host}:${port}/_health`;
  const start = Date.now();

  console.log(`[Setup] Waiting for Strapi at ${url}...`);

  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log("[Setup] Strapi is ready!");
        return;
      }
    } catch {
      // Not ready yet
    }
    await sleep(2000);
    const elapsed = Math.round((Date.now() - start) / 1000);
    console.log(`[Setup] Waiting for Strapi... (${elapsed}s)`);
  }

  throw new Error(`Strapi did not become ready within ${timeoutMs}ms`);
}

/**
 * Start Strapi via Docker
 *
 * @deprecated Use fixtures instead. Only use for fixture capture script.
 */
export async function startStrapiDocker(): Promise<void> {
  // In CI with STRAPI_HOST set, Strapi is managed externally (service container)
  if (process.env.STRAPI_HOST) {
    console.log(`[Setup] Using external Strapi at ${process.env.STRAPI_HOST}:${STRAPI_PORT}`);
    await waitForStrapi(process.env.STRAPI_HOST, STRAPI_PORT);
    return;
  }

  if (!isDockerAvailable()) {
    throw new Error("Docker is required to run E2E tests. Please install Docker and try again.");
  }

  // Check if already running (e.g., from a previous test run)
  if (isStrapiContainerRunning()) {
    console.log("[Setup] Strapi container already running");
    await waitForStrapi("localhost", STRAPI_PORT);
    return;
  }

  // Clean up any stopped container with the same name
  cleanupStrapiContainer();

  // Use custom image from Forgejo registry (or local build via STRAPI_IMAGE env)
  const strapiImage = process.env.STRAPI_IMAGE || "forgejo.rogge.vip/contfu/strapi-test:latest";
  console.log(`[Setup] Starting Strapi via Docker (${strapiImage})...`);

  // Pre-configured with article content type for E2E testing
  // Let Docker use native platform (arm64 on M1 Mac, amd64 in CI)
  const dockerArgs = [
    "run",
    "-d",
    "--name",
    STRAPI_CONTAINER_NAME,
    "-p",
    `${STRAPI_PORT}:1337`,
    strapiImage,
  ];

  execSync(`docker ${dockerArgs.join(" ")}`, { stdio: "inherit" });

  await waitForStrapi("localhost", STRAPI_PORT);
}

/**
 * Stop Strapi Docker container
 *
 * @deprecated Use fixtures instead. Only use for fixture capture script.
 */
export function stopStrapiDocker(): void {
  // Don't stop if using external Strapi (CI service container)
  if (process.env.STRAPI_HOST) {
    console.log("[Setup] External Strapi - not stopping");
    return;
  }

  console.log("[Setup] Stopping Strapi container...");
  cleanupStrapiContainer();
}

/**
 * Legacy function for backwards compatibility
 *
 * @deprecated Use fixtures instead. Only use for fixture capture script.
 * Now just starts Docker-based Strapi
 */
export async function setupStrapiDemo(): Promise<void> {
  await startStrapiDocker();
}

// Run if executed directly — no-op, fixtures are used now
if (import.meta.main) {
  console.log(
    "[Setup] E2E tests now use captured fixtures. Strapi Docker is no longer started automatically.",
  );
  console.log(
    "[Setup] To capture new fixtures, use: bun tests/e2e/scripts/capture-strapi-fixtures.ts",
  );
}
