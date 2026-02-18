import { beforeEach } from "bun:test";
import { db, assetTable, itemLinkTable, itemTable } from "../src/index";

beforeEach(async () => {
  await db.delete(assetTable).execute();
  await db.delete(itemLinkTable).execute();
  await db.delete(itemTable).execute();
});
