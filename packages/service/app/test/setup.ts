import { db } from "$lib/server/db/db";
import {
  accountTable,
  collectionTable,
  connectionTable,
  consumerTable,
  itemIdConflictResolutionTable,
  quotaTable,
  sessionTable,
  sourceTable,
  userTable,
  verificationTable,
  webhookLogTable,
} from "$lib/server/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  // Delete in reverse dependency order to respect foreign keys
  await db.delete(webhookLogTable);
  await db.delete(itemIdConflictResolutionTable);
  await db.delete(connectionTable);
  await db.delete(collectionTable);
  await db.delete(consumerTable);
  await db.delete(sourceTable);
  await db.delete(quotaTable);
  await db.delete(sessionTable);
  await db.delete(accountTable);
  await db.delete(verificationTable);
  await db.delete(userTable);
}
