import { dbUrl, ensureDbDir, resolveMigrationsFolder } from "./db-shared";
import * as schema from "./schema";

const dynamicImport = (path: string) => new Function("p", "return import(p)")(path) as Promise<any>;
const betterSqlite3Pkg = ["better", "sqlite3"].join("-");
const drizzleBetterSqlite3Pkg = ["drizzle-orm", betterSqlite3Pkg].join("/");
const drizzleBetterSqlite3MigratorPkg = ["drizzle-orm", betterSqlite3Pkg, "migrator"].join("/");

export async function createNodeDatabaseClient(url: string) {
  const migrationsFolder = resolveMigrationsFolder();
  await ensureDbDir(url);

  // @ts-ignore - better-sqlite3 is an optional dependency
  const Database = await dynamicImport(betterSqlite3Pkg);
  const { drizzle } = await dynamicImport(drizzleBetterSqlite3Pkg);
  const { migrate } = await dynamicImport(drizzleBetterSqlite3MigratorPkg);

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
