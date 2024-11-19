import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate as drizzleMigrate } from "drizzle-orm/libsql/migrator";
import { schema } from "./schema";

const client = createClient({
  url: process.env.DATABASE_URL ?? ":memory:",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

client.execute("PRAGMA foreign_keys = ON");
client.execute("PRAGMA journal_mode = WAL");

export const db = drizzle(client, { schema });

export async function migrate(migrationsFolder = "../migrations") {
  await drizzleMigrate(db, { migrationsFolder });
}
