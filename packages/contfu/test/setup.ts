import { db } from "../src/infra/db/db";
import {
  fileTable,
  collectionsTable,
  itemFileTable,
  itemsTable,
  linkTable,
  mediaVariantTable,
  syncTable,
} from "../src/infra/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export function truncateAllTables(): void {
  db.delete(mediaVariantTable).run();
  db.delete(itemFileTable).run();
  db.delete(fileTable).run();
  db.delete(linkTable).run();
  db.delete(itemsTable).run();
  db.delete(syncTable).run();
  db.delete(collectionsTable).run();
}
