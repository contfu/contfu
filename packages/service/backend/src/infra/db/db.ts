import { AsyncLocalStorage } from "node:async_hooks";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type { EmptyRelations } from "drizzle-orm/relations";
import * as schema from "./schema";

type Db = PgAsyncDatabase<PgQueryResultHKT, typeof schema, EmptyRelations>;

// Use PGLite only when PGLITE_DATA_DIR is set AND DATABASE_URL is not.
// When DATABASE_URL is set the app connects to a TCP PostgreSQL server
// (in E2E tests: a PGLite socket server started by seed-and-serve.ts).
// Vite inlines process.env.NODE_ENV as "production" during SSR builds
// which tree-shakes the PGLite path, but neither PGLITE_DATA_DIR nor
// DATABASE_URL is inlined, so they are safe to check at runtime.
const isTestMode = !!process.env.PGLITE_DATA_DIR && !process.env.DATABASE_URL;
const dbContext = new AsyncLocalStorage<Db>();

const migrationsFolder = resolveMigrationsFolder();

/** Direct SQL client for raw queries (production only, undefined in test mode) */
export let dbClient: import("bun").SQL | undefined;

/** PGlite client reference (test mode only) — used by closeDb() */
let pgliteClient: { close(): Promise<void> } | undefined;

/** Starts a transaction on the raw DB client and yields a scoped Drizzle instance to the callback. */
let withTransaction: <T>(fn: (db: Db) => Promise<T>) => Promise<T>;

/** Returns the raw PGlite client (test/seed mode only). Used by the E2E seed script to attach a socket server. */
export function getRawPgliteClient(): unknown {
  return pgliteClient;
}

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
  // Skip database initialization during SvelteKit build and in Worker threads
  // (the sync worker uses its own workerDb, not this root database).
  const isWorkerThread =
    typeof Bun !== "undefined" ? !Bun.isMainThread : typeof self !== "undefined";
  if (process.env.SKIP_DB_INIT === "true" || isWorkerThread) {
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

    // Create roles before migrations — policies reference app_user/service_role.
    // Use DO blocks with exception handling for idempotency (PGlite databases
    // may already have roles from a previous run, e.g. when global-setup seeds
    // the database before the server opens it).
    await client.exec(`
      DO $$ BEGIN CREATE ROLE "app_user"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN CREATE ROLE "service_role"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      GRANT USAGE ON SCHEMA public TO "app_user", "service_role";
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "app_user", "service_role";
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "app_user", "service_role";
    `);

    // Apply schema via migrations (pushSchema has drizzle-kit import conflict)
    const drizzleMigratorPkg = "drizzle-orm/pglite/migrator";
    const { migrate } = await import(/* @vite-ignore */ drizzleMigratorPkg);
    await migrate(database, { migrationsFolder });

    return database;
  }

  // E2E test mode (built server): the seed-and-serve.ts seeder shares its PGlite
  // client via globalThis so the built server can reuse it in-process instead of
  // going through the TCP socket.  This avoids cross-platform TCP handshake issues
  // (bun.SQL sends SSL negotiation that pglite-socket@0.0.22 does not handle on macOS).
  if (process.env.PGLITE_DATA_DIR && (globalThis as any).__CONTFU_PGLITE_CLIENT) {
    const drizzlePglitePkg = "drizzle-orm/pglite";
    const { drizzle } = await import(/* @vite-ignore */ drizzlePglitePkg);
    const client = (globalThis as any).__CONTFU_PGLITE_CLIENT;
    const database = drizzle({ client, schema });

    withTransaction = (fn) =>
      client.transaction((txClient: unknown) => fn(drizzle({ client: txClient as any, schema })));

    // No migrations — the seeder already ran them before sharing the client.
    return database;
  }

  // E2E test mode: sync worker connecting to PGLite via pglite-socket TCP server.
  // Use postgres.js instead of bun.SQL because bun.SQL on macOS sends an SSL
  // negotiation request (SSLRequest) that pglite-socket@0.0.22 does not handle
  // and responds to by closing the connection.  postgres.js skips SSL on
  // plaintext connections and works on all platforms.
  if (process.env.PGLITE_DATA_DIR && process.env.DATABASE_URL) {
    const postgresPkg = "postgres";
    const drizzlePostgresPkg = "drizzle-orm/postgres-js";
    const { default: postgres } = await import(/* @vite-ignore */ postgresPkg);
    const { drizzle } = await import(/* @vite-ignore */ drizzlePostgresPkg);
    // max: 1 — pglite-socket processes one statement at a time (PGLite is single-threaded)
    const client = postgres(process.env.DATABASE_URL, { ssl: false, max: 1 });

    withTransaction = (fn) =>
      client.begin((txSql: unknown) =>
        fn(drizzle(txSql as any, { schema }) as unknown as Db),
      ) as Promise<ReturnType<typeof fn> extends Promise<infer U> ? U : never>;

    // No migrations — the seeder already ran them via PGLite before starting the TCP server.
    return drizzle(client, { schema }) as unknown as Db;
  }

  // Production: Bun SQL with PostgreSQL
  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");

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

  const { migrate } = await import("drizzle-orm/bun-sql/migrator");
  await migrate(database, { migrationsFolder });

  // Grant permissions on all tables to app_user and service_role.
  // ALTER DEFAULT PRIVILEGES (set in CNPG postInitSQL) only covers tables
  // created after that statement ran. Tables added by later migrations need
  // an explicit grant.
  await database.execute(
    sql`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "app_user", "service_role"`,
  );
  await database.execute(
    sql`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "app_user", "service_role"`,
  );

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
