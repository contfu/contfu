import { db } from "../src/infra/db/db";
import {
  assetTable,
  collectionsTable,
  itemAssetTable,
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
  db.delete(itemAssetTable).run();
  db.delete(assetTable).run();
  db.delete(linkTable).run();
  db.delete(itemsTable).run();
  db.delete(syncTable).run();
  db.delete(collectionsTable).run();
}
