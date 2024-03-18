import { Database } from "bun:sqlite";
import { beforeAll, beforeEach } from "bun:test";
import { BunSqliteDialect } from "kysely-bun-sqlite";
import { setupDb, truncate } from "../src/core/db/db";
import { sqliteMigrationProvider } from "../src/core/db/migrations/sqlite";

beforeAll(async () => {
  const dialect = new BunSqliteDialect({
    database: new Database(":memory:"),
  });
  await setupDb({ dialect, migratonProvider: sqliteMigrationProvider });
});

beforeEach(async () => {
  await truncate();
});
