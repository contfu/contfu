import { sql } from "drizzle-orm";
import { db } from "@contfu/svc-backend/infra/db/db";

/**
 * Truncates all tables and resets identity sequences.
 * Uses PostgreSQL TRUNCATE ... RESTART IDENTITY CASCADE for efficient cleanup.
 * Call this in beforeEach() to ensure test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE
      webhook_log,
      item_id_conflict_resolution,
      incident,
      influx,
      connection,
      source_collection,
      consumer,
      collection,
      source,
      quota,
      session,
      account,
      verification,
      "user"
    RESTART IDENTITY CASCADE
  `);
}
