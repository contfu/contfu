import { sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";

/**
 * Fail a job. If the job has remaining attempts, it is rescheduled to pending
 * with a 30-second delay. If max attempts reached, it is marked as permanently failed.
 *
 * @param db - Database connection (main thread or worker)
 * @param jobId - The job ID that failed
 * @param errorMessage - Description of the failure
 */
export async function failJob(
  db: PgAsyncDatabase<any, typeof schema, any>,
  jobId: number,
  errorMessage: string,
): Promise<void> {
  await db.execute(sql`
    UPDATE sync_job
    SET
      "errorMessage" = ${errorMessage},
      status = CASE
        WHEN attempts >= "maxAttempts" THEN 'failed'
        ELSE 'pending'
      END,
      "completedAt" = CASE
        WHEN attempts >= "maxAttempts" THEN now()
        ELSE NULL
      END,
      "scheduledAt" = CASE
        WHEN attempts >= "maxAttempts" THEN "scheduledAt"
        ELSE now() + interval '30 seconds'
      END,
      "workerId" = CASE
        WHEN attempts >= "maxAttempts" THEN "workerId"
        ELSE NULL
      END
    WHERE id = ${jobId}
  `);
}
