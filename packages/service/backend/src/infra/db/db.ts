import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type { EmptyRelations } from "drizzle-orm/relations";
import * as schema from "./schema";

type Db = PgAsyncDatabase<PgQueryResultHKT, typeof schema, EmptyRelations>;

// Use PGLITE_DATA_DIR presence instead of NODE_ENV to detect test mode.
// Vite inlines process.env.NODE_ENV as "production" during SSR builds,
// which tree-shakes the PGLite path. PGLITE_DATA_DIR is not inlined.
const isTestMode = !!process.env.PGLITE_DATA_DIR;
const dbContext = new AsyncLocalStorage<Db>();

const migrationsFolder = resolveMigrationsFolder();

/** Direct SQL client for raw queries (production only, undefined in test mode) */
export let dbClient: import("bun").SQL | undefined;

/** PGlite client reference (test mode only) — used by closeDb() */
let pgliteClient: { close(): Promise<void> } | undefined;

/** Starts a transaction on the raw DB client and yields a scoped Drizzle instance to the callback. */
let withTransaction: <T>(fn: (db: Db) => Promise<T>) => Promise<T>;

/** Close the underlying database connection. Needed in E2E globalSetup to release the file lock. */
export async function closeDb() {
  if (pgliteClient) {
    await pgliteClient.close();
    pgliteClient = undefined;
  }
  if (dbClient) {
    await dbClient.close();
    dbClient = undefined;
  }
}

async function createDb() {
  // Skip database initialization during SvelteKit build (no database available)
  if (process.env.SKIP_DB_INIT === "true") {
    return null as unknown as Db;
  }

  if (isTestMode) {
    const pglitePkg = "@electric-sql/pglite";
    const drizzlePglitePkg = "drizzle-orm/pglite";
    const { PGlite } = await import(/* @vite-ignore */ pglitePkg);
    const { drizzle } = await import(/* @vite-ignore */ drizzlePglitePkg);
    const dataDir = process.env.PGLITE_DATA_DIR;
    const client = new PGlite(dataDir === ":memory:" ? undefined : dataDir || undefined);
    pgliteClient = client;
    const database = drizzle({ client, schema });

    withTransaction = (fn) =>
      client.transaction((txClient: unknown) => fn(drizzle({ client: txClient as any, schema })));

    // Apply schema via migrations (pushSchema has drizzle-kit import conflict)
    const drizzleMigratorPkg = "drizzle-orm/pglite/migrator";
    const { migrate } = await import(/* @vite-ignore */ drizzleMigratorPkg);
    await migrate(database, { migrationsFolder });

    return database;
  }

  // Production: Bun SQL with PostgreSQL
  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const { migrate } = await import("drizzle-orm/bun-sql/migrator");

  const client = new SQL({
    url: process.env.DATABASE_URL,
    // max: 1 removed — pool is now unrestricted; each user-scoped request
    // reserves a dedicated connection via client.begin() below.
    idleTimeout: 30,
    connectionTimeout: 10,
  });
  dbClient = client;

  withTransaction = (fn) =>
    client.begin((txClient) =>
      fn(drizzle({ client: txClient as import("bun").SQL, schema })),
    ) as Promise<ReturnType<typeof fn> extends Promise<infer U> ? U : never>;

  const database = drizzle({ client, schema });
  await migrate(database, { migrationsFolder });

  return database;
}

function resolveMigrationsFolder(): string {
  if (process.env.NODE_ENV === "production") {
    return resolve(process.cwd(), "packages/service/backend/db/migrations");
  }
  return resolve(import.meta.dirname, "../../../db/migrations");
}

const rootDb: Db = await createDb();

function getActiveDb(): Db {
  return dbContext.getStore() ?? rootDb;
}

export async function withUserDbContext<T>(userId: number, fn: () => Promise<T>): Promise<T> {
  // Reserve a dedicated connection from the pool (production: client.begin,
  // test: pglite.transaction) and create a scoped Drizzle instance so that
  // SET LOCAL statements are confined to this transaction.
  return withTransaction(async (scopedDb) => {
    await scopedDb.execute(sql`SET LOCAL ROLE app_user`);
    await scopedDb.execute(sql`SET LOCAL app.current_user_id = '${sql.raw(String(userId))}'`);
    return dbContext.run(scopedDb, fn);
  });
}

export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const currentDb = getActiveDb() as unknown as Record<PropertyKey, unknown>;
    const value = Reflect.get(currentDb, prop, receiver);
    if (typeof value === "function") {
      return value.bind(currentDb);
    }
    return value;
  },
});

// Seed development test user (skipped in production and during build)
if (process.env.SKIP_DB_INIT !== "true" && process.env.NODE_ENV !== "production") {
  const { seedDevUser } = await import("./seed-dev");
  await seedDevUser(rootDb);
}

// Re-export schema tables for convenience
export * from "./schema";
