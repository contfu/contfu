import { Effect } from "effect";
import { eq, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Fail a job. If the job has remaining attempts, it is rescheduled to pending
 * with a 30-second delay. If max attempts reached, it is marked as permanently failed.
 *
 * @param jobId - The job ID that failed
 * @param errorMessage - Description of the failure
 */
export const failJob = (jobId: number, errorMessage: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: async () => {
        const [job] = await db
          .select({ attempts: syncJobTable.attempts, maxAttempts: syncJobTable.maxAttempts })
          .from(syncJobTable)
          .where(eq(syncJobTable.id, jobId))
          .limit(1);

        if (!job) return;

        const exhausted = job.attempts >= job.maxAttempts;
        await db
          .update(syncJobTable)
          .set({
            errorMessage,
            status: exhausted ? "failed" : "pending",
            completedAt: exhausted ? sql`now()` : null,
            scheduledAt: exhausted ? undefined : sql`now() + interval '30 seconds'`,
            workerId: exhausted ? undefined : null,
          })
          .where(eq(syncJobTable.id, jobId));
      },
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.fail"));
