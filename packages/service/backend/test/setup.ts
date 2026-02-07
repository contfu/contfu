import { db } from "../src/infra/db/db";
import {
  accountTable,
  collectionTable,
  connectionTable,
  consumerTable,
  incidentTable,
  influxTable,
  itemIdConflictResolutionTable,
  quotaTable,
  sessionTable,
  sourceCollectionTable,
  sourceTable,
  userTable,
  verificationTable,
  webhookLogTable,
} from "../src/infra/db/schema";

/**
 * Truncates all tables in the correct order (respecting foreign key constraints).
 * Call this in beforeEach() to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  // Delete in reverse dependency order to respect foreign keys
  await db.delete(webhookLogTable);
  await db.delete(itemIdConflictResolutionTable);
  await db.delete(incidentTable);
  await db.delete(connectionTable);
  await db.delete(influxTable);
  await db.delete(collectionTable);
  await db.delete(sourceCollectionTable);
  await db.delete(consumerTable);
  await db.delete(sourceTable);
  await db.delete(quotaTable);
  await db.delete(sessionTable);
  await db.delete(accountTable);
  await db.delete(verificationTable);
  await db.delete(userTable);
}
