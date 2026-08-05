import { AsyncLocalStorage } from "node:async_hooks";
import type { EmptyRelations } from "drizzle-orm";
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";
import { migrations } from "./generated-migrations";
import {
  dbUrl,
  ensureDbDir,
  runEmbeddedMigrations,
  type DrizzleMigrationExecutor,
} from "./db-shared";
import * as schema from "./schema";

export type Database = SQLiteBunDatabase<typeof schema, EmptyRelations>;
export type DbCtx = Parameters<Parameters<Database["transaction"]>[0]>[0] | Database;

export async function createBunDatabaseClient(url: string): Promise<Database> {
  await ensureDbDir(url);

  const { Database } = await import("bun:sqlite");
  const { drizzle } = await import("drizzle-orm/bun-sqlite");

  const client = new Database(url);
  client.run("PRAGMA foreign_keys = ON");
  if (url !== ":memory:") {
    client.run("PRAGMA journal_mode = WAL");
  }

  const db = drizzle({ client, schema });
  runEmbeddedMigrations(db as unknown as DrizzleMigrationExecutor, migrations);
  return db;
}

const defaultDb = await createBunDatabaseClient(dbUrl);
const databaseContext = new AsyncLocalStorage<Database>();

function createDatabaseProxy(getActiveDb: () => Database): Database {
  return new Proxy({} as Database, {
    get(_target, prop, receiver) {
      const activeDb = getActiveDb() as unknown as Record<PropertyKey, unknown>;
      const value = Reflect.get(activeDb, prop, receiver);
      return typeof value === "function" ? value.bind(activeDb) : value;
    },
  });
}

/**
 * Bind Contfu runtime database calls to one server request. Calls outside this scope
 * retain the default database selected when this module was initialized.
 */
export function withBunDatabase<T>(database: Database, fn: () => T): T {
  return databaseContext.run(database, fn);
}

export const createDatabaseClient = createBunDatabaseClient;
export const withDatabase = withBunDatabase;

// Preserve existing query ergonomics while allowing Server instances to scope requests.
export const db: DbCtx = createDatabaseProxy(() => databaseContext.getStore() ?? defaultDb);
