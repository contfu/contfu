import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export const client = new Database(Bun.env.DATABASE_PATH ?? ":memory:");

client.run("PRAGMA foreign_keys = ON");
client.run("PRAGMA journal_mode = WAL");

export const db = drizzle(client);

migrate(db, { migrationsFolder: "./migrations" });

export function withSchema<T extends Record<string, unknown>>(schema: T) {
  return drizzle(client, { schema });
}
