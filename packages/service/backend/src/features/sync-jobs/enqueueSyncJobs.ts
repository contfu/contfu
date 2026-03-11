import { Effect } from "effect";
import { and, inArray, or, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { createLogger } from "../../infra/logger/index";
import { syncJobTable } from "../../infra/db/schema";

const log = createLogger("sync-jobs");

/**
 * Enqueue sync jobs for the given collections.
 * Skips collections that already have a pending or running job
 * to prevent duplicate work.
 *
 * @param collectionIds - IDs of collections to sync
 * @returns Number of jobs enqueued
 */
export const enqueueSyncJobs = (collectionIds: number[]) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    return yield* Effect.tryPromise({
      try: async () => {
        if (collectionIds.length === 0) return 0;

        // Find collections that already have pending or running jobs
        const existing = await db
          .select({ collectionId: syncJobTable.collectionId })
          .from(syncJobTable)
          .where(
            and(
              inArray(syncJobTable.collectionId, collectionIds),
              or(eq(syncJobTable.status, "pending"), eq(syncJobTable.status, "running")),
            ),
          );

        const alreadyQueued = new Set(existing.map((r) => r.collectionId));
        const toEnqueue = collectionIds.filter((id) => !alreadyQueued.has(id));

        if (alreadyQueued.size > 0) {
          log.debug({ skippedCount: alreadyQueued.size }, "Sync jobs skipped (already queued)");
        }

        if (toEnqueue.length === 0) return 0;

        await db.insert(syncJobTable).values(
          toEnqueue.map((collectionId) => ({
            collectionId,
          })),
        );

        log.info({ count: toEnqueue.length, collectionIds: toEnqueue }, "Sync jobs enqueued");

        return toEnqueue.length;
      },
      catch: (e) => new DatabaseError({ cause: e }),
    });
  }).pipe(Effect.withSpan("syncJobs.enqueue"));
