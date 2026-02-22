import { Effect } from "effect";
import { sql } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Delete completed and failed jobs older than 1 day.
 * Prevents sync_job table from growing unbounded.
 *
 * @param db - Database connection (main thread or worker)
 * @returns Number of deleted jobs
 */
export const cleanupCompletedJobs = (db: DrizzleDb) =>
  Effect.tryPromise({
    try: async () => {
      const result = await db.execute(sql`
        DELETE FROM sync_job
        WHERE status IN ('completed', 'failed')
          AND "completedAt" < now() - interval '1 day'
      `);
      return (result as unknown as { rowCount: number }).rowCount ?? 0;
    },
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.cleanupCompleted"));
