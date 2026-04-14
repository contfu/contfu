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
  client.run("PRAGMA journal_mode = WAL");

  const db = drizzle({ client, schema });
  runEmbeddedMigrations(db as unknown as DrizzleMigrationExecutor, migrations);
  return db;
}

export const db: DbCtx = await createBunDatabaseClient(dbUrl);
