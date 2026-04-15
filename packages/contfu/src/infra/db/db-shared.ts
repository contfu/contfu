import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export const dbUrl: string =
  process.env.DATABASE_URL ?? (process.env.NODE_ENV === "test" ? ":memory:" : "data/contfu.sqlite");

export type GeneratedMigration = {
  name: string;
  sql: string;
  timestamp: number;
};

export type DrizzleMigrationExecutor = {
  dialect: {
    migrate(migrations: ReturnType<typeof buildDrizzleMigrations>, session: unknown): void;
  };
  session: unknown;
};

export function buildDrizzleMigrations(migrations: GeneratedMigration[]) {
  return migrations.map((migration) => ({
    sql: migration.sql.split("--> statement-breakpoint"),
    folderMillis: migration.timestamp,
    hash: "",
    bps: true,
    name: migration.name,
  }));
}

export function runEmbeddedMigrations(
  db: DrizzleMigrationExecutor,
  migrations: GeneratedMigration[],
): void {
  db.dialect.migrate(buildDrizzleMigrations(migrations), db.session);
}

export async function ensureDbDir(url: string) {
  if (url !== ":memory:") {
    await mkdir(dirname(url), { recursive: true });
  }
}
