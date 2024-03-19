import { beforeAll } from "bun:test";
import { BunWorkerDialect } from "kysely-bun-worker";
import { setupDb } from "../src/core/db/db";

beforeAll(async () => {
  const dialect = new BunWorkerDialect();
  await setupDb({ dialect });
});
