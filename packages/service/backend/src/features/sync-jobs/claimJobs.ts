import { Effect } from "effect";
import { sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import type { SyncJob } from "../../infra/db/schema";

/**
 * Atomically claim pending jobs using SKIP LOCKED.
 * This prevents duplicate execution when multiple workers compete for jobs.
 *
 * Raw SQL required: Drizzle doesn't support FOR UPDATE SKIP LOCKED in subqueries.
 *
 * @param workerId - Unique identifier for the claiming worker
 * @param limit - Maximum number of jobs to claim (default 10)
 * @returns Array of claimed jobs
 */
export const claimJobs = (workerId: string, limit = 10) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: async () => {
        const result = await db.execute<SyncJob>(sql`
          UPDATE sync_job
          SET status = 'running',
              "startedAt" = now(),
              "workerId" = ${workerId},
              attempts = attempts + 1
          WHERE id IN (
            SELECT id FROM sync_job
            WHERE status = 'pending'
              AND "scheduledAt" <= now()
              AND attempts < "maxAttempts"
            ORDER BY "scheduledAt" ASC
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )
          RETURNING *
        `);
        // db.execute returns { rows: SyncJob[] } in PGlite
        const rows = Array.isArray(result) ? result : ((result as { rows: SyncJob[] }).rows ?? []);
        return rows;
      },
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.claim"));
