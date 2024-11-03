import { beforeAll, beforeEach } from "bun:test";
import { BunWorkerDialect } from "kysely-bun-worker";
import { setupDb, truncate } from "../src/core/db/db";

beforeAll(async () => {
  const dialect = new BunWorkerDialect();
  await setupDb({ dialect });
});

beforeEach(async () => {
  await truncate();
});
