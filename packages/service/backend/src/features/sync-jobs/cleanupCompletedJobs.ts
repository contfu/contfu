import { Effect } from "effect";
import { and, inArray, lt, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Delete completed and failed jobs older than 1 day.
 * Prevents sync_job table from growing unbounded.
 *
 * @returns Number of deleted jobs
 */
export const cleanupCompletedJobs = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: async () => {
        const deleted = await db
          .delete(syncJobTable)
          .where(
            and(
              inArray(syncJobTable.status, ["completed", "failed"]),
              lt(syncJobTable.completedAt, sql`now() - interval '1 day'`),
            ),
          )
          .returning({ id: syncJobTable.id });
        return deleted.length;
      },
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.cleanupCompleted"));
