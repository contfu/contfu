import fs from "node:fs";
import path from "node:path";

const PGLITE_DATA_DIR = path.join(import.meta.dir, ".pglite-e2e");

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

  const { db, closeDb } = await import("@contfu/svc-backend/infra/db/db");

  // Seed webhook test data (imported from next to the test file)
  const { seedWebhookData } = await import("./e2e/notion-webhooks.seed");
  await seedWebhookData(db);

  // Release file lock so the server process can open the same database
  await closeDb();
}
