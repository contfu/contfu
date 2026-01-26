import { beforeEach } from "bun:test";
import { db, assetTable, pageLinkTable, pageTable } from "../src/index";

beforeEach(async () => {
  await db.delete(assetTable).execute();
  await db.delete(pageLinkTable).execute();
  await db.delete(pageTable).execute();
});
