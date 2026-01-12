import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sql/sqlite";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { detectRuntime } from "../../util/runtime";
import * as schema from "./schema";

type Database =
  | BunSQLiteDatabase<typeof schema>
  | BetterSQLite3Database<typeof schema>;

const dbUrl: string = process.env.DATABASE_URL ?? ":memory:";

export const db: Database = await createDatabaseClient(dbUrl);

async function createDatabaseClient(url: string) {
  const runtime = detectRuntime();
  const migrationsFolder = join(
    dirname(fileURLToPath(import.meta.url)),
    "../../../db/migrations",
  );

  if (runtime === "bun") {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");

    const client = new Database(url);
    client.run("PRAGMA foreign_keys = ON");
    client.run("PRAGMA journal_mode = WAL");

    const db = drizzle({ client, schema });
    migrate(db, { migrationsFolder });
    return db;
  }

  // @ts-ignore - better-sqlite3 is an optional dependency
  const Database = await import("better-sqlite3");
  const { drizzle } = await import("drizzle-orm/better-sqlite3");
  const { migrate } = await import("drizzle-orm/better-sqlite3/migrator");

  const DatabaseClass = Database.default || Database;
  const client = new DatabaseClass(url);
  client.pragma("foreign_keys = ON");
  client.pragma("journal_mode = WAL");

  const db = drizzle(client, { schema });
  migrate(db, { migrationsFolder });
  return db;
}
