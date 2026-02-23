import { Effect } from "effect";
import { sql } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";

/**
 * Recover jobs that have been stuck in 'running' status for more than 5 minutes.
 * These are likely from crashed workers. Resets them to 'pending' so they can
 * be picked up by another worker.
 *
 * @param db - Database connection (main thread or worker)
 * @returns Number of recovered jobs
 */
export const recoverStuckJobs = (db: DrizzleDb) =>
  Effect.tryPromise({
    try: async () => {
      const result = await db.execute(sql`
        UPDATE sync_job
        SET status = 'pending',
            "workerId" = NULL
        WHERE status = 'running'
          AND "startedAt" < now() - interval '5 minutes'
      `);
      return (result as { rowCount: number }).rowCount ?? 0;
    },
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.recoverStuck"));
