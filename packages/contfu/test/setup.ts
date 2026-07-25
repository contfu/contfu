import { db } from "../src/infra/db/db";
import {
  fileTable,
  collectionsTable,
  externalLinkTable,
  internalLinkTable,
  itemFileTable,
  itemsTable,
  mediaMasterTable,
  mediaVariantTable,
  syncTable,
} from "../src/infra/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export function truncateAllTables(): void {
  db.delete(mediaVariantTable).run();
  db.delete(mediaMasterTable).run();
  db.delete(itemFileTable).run();
  db.delete(fileTable).run();
  db.delete(externalLinkTable).run();
  db.delete(internalLinkTable).run();
  db.delete(itemsTable).run();
  db.delete(syncTable).run();
  db.delete(collectionsTable).run();
}
