import { sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";

/**
 * Delete completed and failed jobs older than 1 day.
 * Prevents sync_job table from growing unbounded.
 *
 * @param db - Database connection (main thread or worker)
 * @returns Number of deleted jobs
 */
export async function cleanupCompletedJobs(
  db: PgAsyncDatabase<any, typeof schema, any>,
): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM sync_job
    WHERE status IN ('completed', 'failed')
      AND "completedAt" < now() - interval '1 day'
  `);
  return (result as unknown as { rowCount: number }).rowCount ?? 0;
}
