import { Database } from "bun:sqlite";
import { beforeAll } from "bun:test";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { setupDb } from "../src/core/db/db";

beforeAll(async () => {
  const dialect = new BunSqliteDialect({
    database: new Database(":memory:"),
  });
  await setupDb({ dialect });
});
