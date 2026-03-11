import { Effect } from "effect";
import { and, eq, lt, sql } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Recover jobs that have been stuck in 'running' status for more than 5 minutes.
 * These are likely from crashed workers. Resets them to 'pending' so they can
 * be picked up by another worker.
 *
 * @returns Number of recovered jobs
 */
export const recoverStuckJobs = () =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: async () => {
        const recovered = await db
          .update(syncJobTable)
          .set({ status: "pending", workerId: null })
          .where(
            and(
              eq(syncJobTable.status, "running"),
              lt(syncJobTable.startedAt, sql`now() - interval '5 minutes'`),
            ),
          )
          .returning({ id: syncJobTable.id });
        return recovered.length;
      },
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.recoverStuck"));
