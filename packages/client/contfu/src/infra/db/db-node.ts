import { dbUrl, ensureDbDir, resolveMigrationsFolder } from "./db-shared";
import * as schema from "./schema";

export async function createNodeDatabaseClient(url: string) {
  const migrationsFolder = resolveMigrationsFolder();
  await ensureDbDir(url);

  // @ts-ignore - better-sqlite3 is an optional dependency
  const Database = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");

  const DatabaseClass = Database.default || Database;
  const client = new DatabaseClass(url);
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");

  const db = drizzle(client, { schema });
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  }
  return db;
}

export type Database = Awaited<ReturnType<typeof createNodeDatabaseClient>>;

export const db: Database = await createNodeDatabaseClient(dbUrl);
