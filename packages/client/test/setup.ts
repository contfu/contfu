import { beforeEach } from "bun:test";
import { truncate } from "../src/core/db/db";

beforeEach(async () => {
  await truncate();
});
