import { db } from "../src/infra/db/db";
import { assetTable, itemsTable, linkTable, syncTable } from "../src/infra/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  await db.delete(assetTable);
  await db.delete(linkTable);
  await db.delete(itemsTable);
  await db.delete(syncTable);
}
