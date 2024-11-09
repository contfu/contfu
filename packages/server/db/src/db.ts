import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { schema } from "./schema";

export const client = new Database(process.env.DATABASE_PATH ?? ":memory:");

client.run("PRAGMA foreign_keys = ON");
client.run("PRAGMA journal_mode = WAL");

export const db = drizzle(client, { schema });

migrate(db, { migrationsFolder: "./migrations" });
