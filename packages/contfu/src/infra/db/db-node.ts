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

export async function createNodeDatabaseClient(url: string): Promise<Database> {
  await ensureDbDir(url);

  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/node-sqlite");

  const client = new DatabaseSync(url);
  client.exec("PRAGMA foreign_keys = ON");
  client.exec("PRAGMA journal_mode = WAL");

  const db = drizzle({ client, schema });
  runEmbeddedMigrations(db as unknown as DrizzleMigrationExecutor, migrations);
  return db;
}

export const db: Database = await createNodeDatabaseClient(dbUrl);
