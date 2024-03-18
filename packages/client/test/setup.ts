import { beforeAll, beforeEach } from "bun:test";
import { setupDb, truncate } from "../src/core/db/db";

beforeAll(async () => {
  await setupDb();
});

beforeEach(async () => {
  await truncate();
});
