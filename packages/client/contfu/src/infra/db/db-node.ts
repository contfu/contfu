import type { EmptyRelations } from "drizzle-orm";
import type { NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { dbUrl, ensureDbDir, resolveMigrationsFolder } from "./db-shared";
import * as schema from "./schema";

export type Database = NodeSQLiteDatabase<typeof schema, EmptyRelations>;

export async function createNodeDatabaseClient(url: string): Promise<Database> {
  const migrationsFolder = resolveMigrationsFolder();
  await ensureDbDir(url);

  const { DatabaseSync } = await import("node:sqlite");
  const { drizzle } = await import("drizzle-orm/node-sqlite");
  const { migrate } = await import("drizzle-orm/node-sqlite/migrator");

  const client = new DatabaseSync(url);
  client.exec("PRAGMA foreign_keys = ON");
  client.exec("PRAGMA journal_mode = WAL");

  const db = drizzle({ client, schema });
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  }
  return db;
}

export const db: Database = await createNodeDatabaseClient(dbUrl);
