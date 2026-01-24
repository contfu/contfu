import { beforeEach } from "bun:test";
import { db } from "../src/core/db/db";
import { assetTable, pageLinkTable, pageTable } from "../src/core/db/schema";

beforeEach(async () => {
  await db.delete(assetTable).execute();
  await db.delete(pageLinkTable).execute();
  await db.delete(pageTable).execute();
});
