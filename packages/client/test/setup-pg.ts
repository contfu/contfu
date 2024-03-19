import { beforeAll } from "bun:test";
import { PostgresDialect } from "kysely";
import { Pool } from "pg";
import { setupDb } from "../src/core/db/db";

beforeAll(async () => {
  const dialect = new PostgresDialect({
    pool: new Pool({
      database: "postgres",
      host: "localhost",
      user: "postgres",
      password: "postgres",
      port: 5432,
      max: 10,
    }),
  });
  await setupDb({
    dialect,
    erase: true,
  });
});
