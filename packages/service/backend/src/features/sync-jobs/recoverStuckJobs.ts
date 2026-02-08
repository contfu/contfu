import { sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";

/**
 * Recover jobs that have been stuck in 'running' status for more than 5 minutes.
 * These are likely from crashed workers. Resets them to 'pending' so they can
 * be picked up by another worker.
 *
 * @param db - Database connection (main thread or worker)
 * @returns Number of recovered jobs
 */
export async function recoverStuckJobs(
  db: PgAsyncDatabase<any, typeof schema, any>,
): Promise<number> {
  const result = await db.execute(sql`
    UPDATE sync_job
    SET status = 'pending',
        "workerId" = NULL
    WHERE status = 'running'
      AND "startedAt" < now() - interval '5 minutes'
  `);
  return (result as unknown as { rowCount: number }).rowCount ?? 0;
}
