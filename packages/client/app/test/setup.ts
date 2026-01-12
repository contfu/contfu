import { beforeEach } from "bun:test";
import { db } from "../src/core/db/db";
import { pageLinkTable, pageTable } from "../src/core/db/schema";

beforeEach(async () => {
  db.delete(pageLinkTable);
  db.delete(pageTable);
});
