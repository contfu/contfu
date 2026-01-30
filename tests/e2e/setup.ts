/**
 * E2E Test Setup Script
 *
 * Prepares the environment for E2E tests:
 * 1. Installs Strapi dependencies if needed (postinstall copies .env)
 * 2. Extracts pre-built Strapi admin if available (skips slow build step)
 *
 * Run automatically before tests or manually: bun tests/e2e/setup.ts
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const STRAPI_DIR = resolve(PROJECT_ROOT, "demos/strapi-demo");

export async function setupStrapiDemo(): Promise<void> {
  console.log("[Setup] Preparing Strapi demo for E2E tests...");

  // 1. Check if node_modules exists, if not install (postinstall will copy .env)
  const nodeModulesPath = resolve(STRAPI_DIR, "node_modules");
  if (!existsSync(nodeModulesPath) || !existsSync(resolve(nodeModulesPath, "@strapi"))) {
    console.log("[Setup] Installing Strapi dependencies...");
    execSync("bun install", { cwd: STRAPI_DIR, stdio: "inherit" });
    console.log("[Setup] Strapi dependencies installed (postinstall created .env)");
  }

  // 2. Extract pre-built Strapi admin if dist/ doesn't exist
  const distPath = resolve(STRAPI_DIR, "dist");
  const tarPath = resolve(STRAPI_DIR, "strapi-build.tar.gz");

  if (!existsSync(distPath) && existsSync(tarPath)) {
    console.log("[Setup] Extracting pre-built Strapi admin from strapi-build.tar.gz...");
    execSync(`tar -xzf strapi-build.tar.gz`, { cwd: STRAPI_DIR, stdio: "inherit" });
    console.log("[Setup] Strapi build extracted successfully");
  } else if (!existsSync(distPath)) {
    console.log("[Setup] No pre-built Strapi found, will build on first run (this takes ~10s)");
  } else {
    const distStat = await stat(distPath);
    console.log(`[Setup] Strapi dist/ already exists (modified: ${distStat.mtime.toISOString()})`);
  }

  console.log("[Setup] Strapi demo ready for E2E tests");
}

// Run if executed directly
if (import.meta.main) {
  await setupStrapiDemo();
}
