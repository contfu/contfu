import { Effect } from "effect";
import { eq, sql } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Mark a job as completed.
 *
 * @param db - Database connection (main thread or worker)
 * @param jobId - The job ID to complete
 */
export const completeJob = (db: DrizzleDb, jobId: number) =>
  Effect.tryPromise({
    try: () =>
      db
        .update(syncJobTable)
        .set({
          status: "completed",
          completedAt: sql`now()`,
        })
        .where(eq(syncJobTable.id, jobId)),
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.complete"));
