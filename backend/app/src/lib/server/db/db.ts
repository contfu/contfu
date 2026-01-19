import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql/sqlite";
import { migrate } from "drizzle-orm/bun-sql/sqlite/migrator";
import * as schema from "./schema";

const dbUrl: string = process.env.DATABASE_URL ?? ":memory:";

const migrationsFolder = "./db/migrations";
export const dbClient = new SQL(dbUrl);

await dbClient`PRAGMA foreign_keys = ON`;
await dbClient`PRAGMA journal_mode = WAL`;

export const db = drizzle({ client: dbClient, schema });
migrate(db, { migrationsFolder });
