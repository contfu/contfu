import { AsyncLocalStorage } from "node:async_hooks";
import type { EmptyRelations } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrations } from "./generated-migrations";
import {
  dbUrl,
  defaultDatabaseOptions,
  type DatabaseOptions,
  ensureDbDir,
  runEmbeddedMigrations,
  type DrizzleMigrationExecutor,
} from "./db-shared";
import * as schema from "./schema";

export type Database = NodeSQLiteDatabase<typeof schema, EmptyRelations>;

async function createNodeDatabaseClient(
  url: string,
  options: DatabaseOptions = defaultDatabaseOptions,
): Promise<Database> {
  if (!options.readonly) await ensureDbDir(url);

  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/node-sqlite");

  const client = new DatabaseSync(url, { readOnly: options.readonly ?? false });
  client.exec("PRAGMA foreign_keys = ON");
  if (url !== ":memory:" && !options.readonly) {
    client.exec(`PRAGMA journal_mode = ${options.journalMode === "delete" ? "DELETE" : "WAL"}`);
  }

  const db = drizzle({ client, schema });
  if (!options.readonly)
    runEmbeddedMigrations(db as unknown as DrizzleMigrationExecutor, migrations);
  return db;
}

const defaultDb = await createNodeDatabaseClient(dbUrl);
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

export const createDatabaseClient = createNodeDatabaseClient;
export function withDatabase<T>(database: Database, fn: () => T): T {
  return databaseContext.run(database, fn);
}

export const db: Database = createDatabaseProxy(() => databaseContext.getStore() ?? defaultDb);
