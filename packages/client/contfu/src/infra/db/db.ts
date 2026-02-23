import type { EmptyRelations } from "drizzle-orm";
import type { SQLiteBunDatabase } from "drizzle-orm/bun-sqlite";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { detectRuntime } from "../../util/runtime";
import * as schema from "./schema";

type Database = SQLiteBunDatabase<typeof schema, EmptyRelations>;

const dbUrl: string = process.env.DATABASE_URL ?? ":memory:";

export const db: Database = await createDatabaseClient(dbUrl);

function resolveMigrationsFolder(): string | null {
  const byModulePath = join(dirname(fileURLToPath(import.meta.url)), "../../../db/migrations");
  const byRepoRoot = join(process.cwd(), "packages/client/contfu/db/migrations");
  const byPackageRoot = join(process.cwd(), "db/migrations");

  const candidates = [byModulePath, byRepoRoot, byPackageRoot];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

async function createDatabaseClient(url: string) {
  const runtime = detectRuntime();
  const migrationsFolder = resolveMigrationsFolder();

  if (url !== ":memory:") {
    await mkdir(dirname(url), { recursive: true });
  }

  if (runtime === "bun") {
    const { Database } = await import("bun:sqlite");
    const { drizzle } = await import("drizzle-orm/bun-sqlite");
    const { migrate } = await import("drizzle-orm/bun-sqlite/migrator");

    const client = new Database(url);
    client.run("PRAGMA foreign_keys = ON");
    client.run("PRAGMA journal_mode = WAL");

    const db = drizzle({ client, schema });
    if (migrationsFolder) {
      migrate(db, { migrationsFolder });
    }
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
  if (migrationsFolder) {
    migrate(db, { migrationsFolder });
  }
  return db;
}
