import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql/sqlite";
import { migrate } from "drizzle-orm/bun-sql/sqlite/migrator";
import { join } from "path";
import * as schema from "./schema";

const url = process.env.DATABASE_URL ?? ":memory:";
const client = new SQL(url);
if (client.options.adapter === "sqlite") {
  await client`PRAGMA foreign_keys = ON`;
  await client`PRAGMA journal_mode = WAL`;
}

export const db = drizzle({ client, schema });
const migrationsDir = join(import.meta.dir, "../../db/migrations");
await migrate(db, { migrationsFolder: migrationsDir });

export * from "./schema";
