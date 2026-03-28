import { existsSync, readFileSync } from "node:fs";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import * as schema from "@contfu/svc-backend/infra/db/schema";

const migrationsFolder =
  process.env.MIGRATIONS_PATH ??
  new URL("../../../backend/db/migrations", import.meta.url).pathname;

/**
 * Resolve the database URL for E2E test mode.  Worker threads in Bun don't
 * inherit runtime process.env mutations — they re-read .env from disk.
 * seed-and-serve.ts writes the PGLite socket URL to a well-known file so
 * the Worker can discover it.
 */
function resolveE2eDatabaseUrl(): string | undefined {
  const dir = process.env.PGLITE_DATA_DIR;
  if (!dir) return undefined;
  const urlFile = `${dir}/.socket-url`;
  if (existsSync(urlFile)) return readFileSync(urlFile, "utf8").trim();
  return undefined;
}

async function createWorkerDb() {
  if (!process.env.DATABASE_URL) {
    // Fallback for unit-test environments that don't provide a DATABASE_URL.
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite();
    // Create roles before migrations — policies reference app_user/service_role.
    await client.exec(`
      DO $$ BEGIN CREATE ROLE "app_user"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE "service_role"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      GRANT USAGE ON SCHEMA public TO "app_user", "service_role";
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user", "service_role";
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "app_user", "service_role";
    `);
    const database = drizzle({ client, schema });
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(database, { migrationsFolder });
    return database;
  }

  // E2E test mode: worker connecting to PGLite via pglite-socket TCP server.
  // Use postgres.js because bun.SQL on macOS sends SSL negotiation that
  // pglite-socket@0.0.22 does not support (closes the connection).
  const e2eUrl = resolveE2eDatabaseUrl();
  if (e2eUrl) {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    return drizzle(e2eUrl, { schema, casing: "camelCase" }) as unknown as PgAsyncDatabase<
      any,
      typeof schema,
      any
    >;
  }

  // Production: Bun SQL with PostgreSQL
  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const client = new SQL({
    url: process.env.DATABASE_URL,
    max: 5,
    idleTimeout: 30,
    connectionTimeout: 10,
  });
  return drizzle({ client, schema });
}

export const workerDb: PgAsyncDatabase<any, typeof schema, any> = await createWorkerDb();
