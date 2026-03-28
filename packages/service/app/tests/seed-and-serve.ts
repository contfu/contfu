/**
 * Seeds the PGlite database and then starts the production server.
 * Used by playwright.config.ts webServer — runs INSIDE the server process
 * so the database is seeded before the server opens it.
 */
import fs from "node:fs";

const PGLITE_DATA_DIR = process.env.PGLITE_DATA_DIR!;

// Clean start — remove previous test database
if (fs.existsSync(PGLITE_DATA_DIR)) {
  fs.rmSync(PGLITE_DATA_DIR, { recursive: true });
}

// Set BETTER_AUTH_SECRET for consistent credential encryption
if (!process.env.BETTER_AUTH_SECRET) {
  process.env.BETTER_AUTH_SECRET = "e2e-test-secret-at-least-32-chars-long";
}

// Clear DATABASE_URL so db.ts takes the PGLite-direct path regardless of .env files.
// We set it to the pglite-socket TCP address later, after the socket server is started.
delete process.env.DATABASE_URL;

// Disable Polar (payment provider) — the real API rejects test-domain emails
// and there's no sandbox running in E2E.
delete process.env.POLAR_ACCESS_TOKEN;
delete process.env.POLAR_WEBHOOK_SECRET;

// Import db.ts — triggers PGlite creation, migrations, and dev user seed
const { db, getRawPgliteClient } = await import("@contfu/svc-backend/infra/db/db");

// Seed all test data
const { seedWebhookData } = await import("./e2e/notion-webhooks.seed");
await seedWebhookData(db);

const { seedContentfulWebhookData } = await import("./e2e/contentful-webhooks.seed");
await seedContentfulWebhookData(db);

const { seedSyncData } = await import("./e2e/sync-stream.seed");
await seedSyncData(db);

const { seedMappingEditorData } = await import("./e2e/mapping-editor.seed");
await seedMappingEditorData(db);

const { seedMappingSyncData } = await import("./e2e/mapping-sync.seed");
await seedMappingSyncData(db);

const { seedSchemaResyncData } = await import("./e2e/schema-resync.seed");
await seedSchemaResyncData(db);

const { seedSelectiveResyncData } = await import("./e2e/selective-resync.seed");
await seedSelectiveResyncData(db);

const { seedSnapshotOnConnectData } = await import("./e2e/snapshot-on-connect.seed");
await seedSnapshotOnConnectData(db);

const { seedSchemaSyncData } = await import("./e2e/schema-sync.seed");
await seedSchemaSyncData(db);

// Seed a second user for admin action tests (the admin modifies this user,
// not themselves, to avoid breaking the session).
import { userTable, accountTable } from "@contfu/svc-backend/infra/db/schema";
import { UserRole } from "@contfu/svc-backend/domain/types";
import { eq, sql } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";

const secondUserExists = await db
  .select()
  .from(userTable)
  .where(eq(userTable.email, "other@test.com"))
  .limit(1);

if (secondUserExists.length === 0) {
  const now = new Date();
  const [otherUser] = await db
    .insert(userTable)
    .values({
      name: "Other User",
      email: "other@test.com",
      emailVerified: true,
      approved: true,
      role: UserRole.USER,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: userTable.id });

  await db.insert(accountTable).values({
    accountId: String(otherUser.id),
    providerId: "credential",
    userId: otherUser.id,
    password: await hashPassword("test"),
    createdAt: now,
    updatedAt: now,
  });
  console.log(`[seed-and-serve] Second user seeded: id=${otherUser.id}`);
}

// Set unlimited quotas for the test user so the large number of seeded flows
// across all test suites doesn't trigger flow/collection limit checks.
const [testUser] = await db
  .select({ id: userTable.id })
  .from(userTable)
  .where(eq(userTable.email, "test@test.com"))
  .limit(1);
if (testUser) {
  // Use raw SQL to avoid ORM upsert issues with PGLite
  await db.execute(sql`
    INSERT INTO quota (id, "maxConnections", "maxCollections", "maxFlows", "maxItems")
    VALUES (${testUser.id}, -1, -1, -1, -1)
    ON CONFLICT (id) DO UPDATE SET
      "maxConnections" = -1, "maxCollections" = -1, "maxFlows" = -1, "maxItems" = -1
  `);
  console.log(`[seed-and-serve] Quota set for user ${testUser.id}`);
}

// Share the raw PGlite client via globalThis so the built server's bundled db.ts
// can reuse it directly (in-process) instead of going through a TCP socket.
// This avoids cross-platform TCP handshake issues with pglite-socket.
(globalThis as any).__CONTFU_PGLITE_CLIENT = getRawPgliteClient();
console.log("[seed-and-serve] PGLite client shared via globalThis");

// Start a PostgreSQL TCP server backed by PGlite so the sync worker thread
// can connect via DATABASE_URL (Worker threads cannot share globalThis).
// Use port 0 so the OS picks a free ephemeral port — avoids EADDRINUSE from
// unclean previous runs, which causes pglite-socket@0.0.22's start() to hang
// forever (its error handler only rejects when !this.active, but active is set
// to true before listen(), so port conflicts silently deadlock the promise).
console.log("[seed-and-serve] Starting PGLite TCP server...");
const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");

// Ensure PGlite is fully ready before handing it to pglite-socket.
const rawPgliteClient = getRawPgliteClient() as any;
await rawPgliteClient.waitReady;

const socketServer = new PGLiteSocketServer({
  db: rawPgliteClient,
  port: 0, // OS picks a free ephemeral port
  host: "127.0.0.1",
});
console.log("[seed-and-serve] Calling socketServer.start()...");
await socketServer.start();
// getServerConn() returns "host:port" with the actual OS-assigned port.
const pgliteAddr = socketServer.getServerConn();
process.env.DATABASE_URL = `postgresql://postgres@${pgliteAddr}/postgres`;
// Write the socket URL so Worker threads (which don't inherit process.env mutations)
// can discover the correct PGLite socket address.
fs.writeFileSync(`${PGLITE_DATA_DIR}/.socket-url`, process.env.DATABASE_URL);
console.log(`[seed-and-serve] PGLite TCP server on ${pgliteAddr}, starting server...`);

// Now start the production server
await import("../build/index.js");

