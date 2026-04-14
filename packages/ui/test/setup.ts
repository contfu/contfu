import { beforeEach } from "bun:test";
import { db, fileTable, itemLinkTable, itemTable } from "../src/index";

beforeEach(async () => {
  await db.delete(fileTable).execute();
  await db.delete(itemLinkTable).execute();
  await db.delete(itemTable).execute();
});
