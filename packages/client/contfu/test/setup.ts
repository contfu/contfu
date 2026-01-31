import { db } from "../src/db/db";
import { assetTable, collectionTable, itemsTable, linkTable } from "../src/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  // Delete in reverse dependency order to respect foreign keys
  await db.delete(assetTable);
  await db.delete(linkTable);
  await db.delete(itemsTable);
  await db.delete(collectionTable);
}
