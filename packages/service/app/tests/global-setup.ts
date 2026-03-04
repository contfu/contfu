import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIRNAME = path.dirname(fileURLToPath(import.meta.url));
const PGLITE_DATA_DIR = path.join(DIRNAME, ".pglite-e2e");

/**
 * Playwright global setup: creates a file-based PGlite database,
 * runs migrations, seeds the dev user, then closes the connection.
 * The server (started after this) opens the same database via PGLITE_DATA_DIR.
 */
export default async function globalSetup() {
  // Clean start — remove previous test database
  if (fs.existsSync(PGLITE_DATA_DIR)) {
    fs.rmSync(PGLITE_DATA_DIR, { recursive: true });
  }

  // Set env vars before importing db.ts — its top-level await triggers
  // PGlite creation, migration, and dev user seeding automatically.
  process.env.TEST_MODE = "true";
  process.env.PGLITE_DATA_DIR = PGLITE_DATA_DIR;
  // Match the BETTER_AUTH_SECRET used by the server (from .env) so that
  // credentials encrypted here can be decrypted at runtime.
  if (!process.env.BETTER_AUTH_SECRET) {
    process.env.BETTER_AUTH_SECRET = "e2e-test-secret-at-least-32-chars-long";
  }

  const { db, closeDb } = await import("@contfu/svc-backend/infra/db/db");

  // Seed webhook test data (imported from next to the test file)
  const { seedWebhookData } = await import("./e2e/notion-webhooks.seed");
  await seedWebhookData(db);

  // Seed Contentful webhook test data
  const { seedContentfulWebhookData } = await import("./e2e/contentful-webhooks.seed");
  await seedContentfulWebhookData(db);

  // Seed sync stream test data
  const { seedSyncData } = await import("./e2e/sync-stream.seed");
  await seedSyncData(db);

  // Seed mapping editor test data
  const { seedMappingEditorData } = await import("./e2e/mapping-editor.seed");
  await seedMappingEditorData(db);

  // Seed mapping sync test data
  const { seedMappingSyncData } = await import("./e2e/mapping-sync.seed");
  await seedMappingSyncData(db);

  // Release file lock so the server process can open the same database
  await closeDb();
}
