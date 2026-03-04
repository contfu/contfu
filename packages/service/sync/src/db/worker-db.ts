import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import * as schema from "@contfu/svc-backend/infra/db/schema";

const isTestMode = process.env.NODE_ENV === "test";
const migrationsFolder =
  process.env.MIGRATIONS_PATH ??
  new URL("../../../backend/db/migrations", import.meta.url).pathname;

async function createWorkerDb() {
  if (isTestMode) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const client = new PGlite();
    const database = drizzle({ client, schema });
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(database, { migrationsFolder });
    return database;
  }

  const { SQL } = await import("bun");
  const { drizzle } = await import("drizzle-orm/bun-sql");
  const client = new SQL({
    url: process.env.DATABASE_URL,
    max: 5,
    idleTimeout: 30,
    connectionTimeout: 10,
  });
  return drizzle({ client, schema });
}

export const workerDb: PgAsyncDatabase<any, typeof schema, any> = await createWorkerDb();
