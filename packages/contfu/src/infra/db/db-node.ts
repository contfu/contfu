import { AsyncLocalStorage } from "node:async_hooks";
import type { EmptyRelations } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrations } from "./generated-migrations";
import {
  dbUrl,
  ensureDbDir,
  runEmbeddedMigrations,
  type DrizzleMigrationExecutor,
} from "./db-shared";
import * as schema from "./schema";

export type Database = NodeSQLiteDatabase<typeof schema, EmptyRelations>;

async function createNodeDatabaseClient(url: string): Promise<Database> {
  await ensureDbDir(url);

  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/node-sqlite");

  const client = new DatabaseSync(url);
  client.exec("PRAGMA foreign_keys = ON");
  if (url !== ":memory:") {
    client.exec("PRAGMA journal_mode = WAL");
  }

  const db = drizzle({ client, schema });
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
