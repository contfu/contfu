import { sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";
import type { SyncJob } from "../../infra/db/schema";

/**
 * Atomically claim pending jobs using SKIP LOCKED.
 * This prevents duplicate execution when multiple workers compete for jobs.
 *
 * @param db - Database connection (main thread or worker)
 * @param workerId - Unique identifier for the claiming worker
 * @param limit - Maximum number of jobs to claim (default 10)
 * @returns Array of claimed jobs
 */
export async function claimJobs(
  db: PgAsyncDatabase<any, typeof schema, any>,
  workerId: string,
  limit = 10,
): Promise<SyncJob[]> {
  const rows = await db.execute<SyncJob>(sql`
    UPDATE sync_job
    SET status = 'running',
        "startedAt" = now(),
        "workerId" = ${workerId},
        attempts = attempts + 1
    WHERE id IN (
      SELECT id FROM sync_job
      WHERE status = 'pending'
        AND "scheduledAt" <= now()
        AND attempts < "maxAttempts"
      ORDER BY "scheduledAt" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `);
  return rows as unknown as SyncJob[];
}
