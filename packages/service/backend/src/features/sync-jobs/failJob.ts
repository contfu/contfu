import { Effect } from "effect";
import { sql } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Fail a job. If the job has remaining attempts, it is rescheduled to pending
 * with a 30-second delay. If max attempts reached, it is marked as permanently failed.
 *
 * @param db - Database connection (main thread or worker)
 * @param jobId - The job ID that failed
 * @param errorMessage - Description of the failure
 */
export const failJob = (db: DrizzleDb, jobId: number, errorMessage: string) =>
  Effect.tryPromise({
    try: () =>
      db.execute(sql`
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
      `),
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.fail"));
