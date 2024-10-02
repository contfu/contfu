import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

export const client = new PGlite();

export const db = drizzle(client);

await migrate(db, { migrationsFolder: "./migrations" });

export function withSchema<T extends Record<string, unknown>>(schema: T) {
  return drizzle(client, { schema });
}
