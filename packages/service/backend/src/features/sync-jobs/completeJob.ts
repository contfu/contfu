import { Effect } from "effect";
import { eq, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Mark a job as completed.
 *
 * @param jobId - The job ID to complete
 */
export const completeJob = (jobId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: () =>
        db
          .update(syncJobTable)
          .set({
            status: "completed",
            completedAt: sql`now()`,
          })
          .where(eq(syncJobTable.id, jobId)),
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.complete"));
