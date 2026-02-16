import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import * as schema from "./schema";

const isTestMode = process.env.TEST_MODE === "true";
const dbContext = new AsyncLocalStorage<PgAsyncDatabase<any, typeof schema, any>>();

// Use MIGRATIONS_PATH env var for flexibility, or resolve from import.meta.url for direct imports
const migrationsFolder =
  process.env.MIGRATIONS_PATH ?? new URL("../../../db/migrations", import.meta.url).pathname;

/** Direct SQL client for raw queries (production only, undefined in test mode) */
export let dbClient: import("bun").SQL | undefined;

/** PGlite client reference (test mode only) — used by closeDb() */
let pgliteClient: { close(): Promise<void> } | undefined;

/** Close the underlying database connection. Needed in E2E globalSetup to release the file lock. */
export async function closeDb() {
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = undefined;
  }
}

async function createDb() {
  // Skip database initialization during SvelteKit build (no database available)
  if (process.env.SKIP_DB_INIT === "true") {
    return null as unknown as PgAsyncDatabase<any, typeof schema, any>;
  }

  if (isTestMode) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite(process.env.PGLITE_DATA_DIR);
    pgliteClient = client;
    const database = drizzle({ client, schema });

    // Apply schema via migrations (pushSchema has drizzle-kit import conflict)
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(database, { migrationsFolder });

    return database;
  }

  // Production: Bun SQL with PostgreSQL
  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const { migrate } = await import("drizzle-orm/bun-sql/migrator");

  const client = new SQL({
    url: process.env.DATABASE_URL,
    max: 50,
    idleTimeout: 30,
    connectionTimeout: 10,
  });
  dbClient = client;

  const database = drizzle({ client, schema });
  await migrate(database, { migrationsFolder });

  return database;
}

const rootDb: PgAsyncDatabase<any, typeof schema, any> = await createDb();

function getActiveDb(): PgAsyncDatabase<any, typeof schema, any> {
  return dbContext.getStore() ?? rootDb;
}

export async function withUserDbContext<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  if (isTestMode) {
    return dbContext.run(rootDb, fn);
  }

  return rootDb.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL ROLE app_user`);
    await tx.execute(sql`SET LOCAL app.current_user_id = ${String(userId)}`);
    return dbContext.run(tx as PgAsyncDatabase<any, typeof schema, any>, fn);
  });
}

export const db: PgAsyncDatabase<any, typeof schema, any> = new Proxy(
  {} as PgAsyncDatabase<any, typeof schema, any>,
  {
    get(_target, prop, receiver) {
      const currentDb = getActiveDb() as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(currentDb, prop, receiver);
      if (typeof value === "function") {
        return value.bind(currentDb);
      }
      return value;
    },
  },
);

// Seed development test user (only in non-production mode or when TEST_MODE is set)
if (
  process.env.SKIP_DB_INIT !== "true" &&
  (process.env.NODE_ENV !== "production" || process.env.TEST_MODE)
) {
  const { seedDevUser } = await import("./seed-dev");
  await seedDevUser(db);
}

// Re-export schema tables for convenience
export * from "./schema";
