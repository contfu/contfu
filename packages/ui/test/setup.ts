import { beforeEach } from "bun:test";
import { db } from "../../contfu/src/infra/db/db-bun";
import {
  externalLinkTable,
  fileTable,
  internalLinkTable,
  itemsTable,
} from "../../contfu/src/infra/db/schema";

beforeEach(async () => {
  await db.delete(fileTable).execute();
  await db.delete(externalLinkTable).execute();
  await db.delete(internalLinkTable).execute();
  await db.delete(itemsTable).execute();
});
