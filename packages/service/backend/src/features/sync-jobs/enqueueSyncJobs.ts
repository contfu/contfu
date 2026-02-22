import { Effect } from "effect";
import { and, inArray, or, eq } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { createLogger } from "../../infra/logger/index";
import { syncJobTable } from "../../infra/db/schema";

const log = createLogger("sync-jobs");

/**
 * Enqueue sync jobs for the given source collections.
 * Skips source collections that already have a pending or running job
 * to prevent duplicate work.
 *
 * @param db - Database connection (main thread or worker)
 * @param sourceCollectionIds - IDs of source collections to sync
 * @returns Number of jobs enqueued
 */
export const enqueueSyncJobs = (db: DrizzleDb, sourceCollectionIds: number[]) =>
  Effect.tryPromise({
    try: async () => {
      if (sourceCollectionIds.length === 0) return 0;

      // Find source collections that already have pending or running jobs
      const existing = await db
        .select({ sourceCollectionId: syncJobTable.sourceCollectionId })
        .from(syncJobTable)
        .where(
          and(
            inArray(syncJobTable.sourceCollectionId, sourceCollectionIds),
            or(eq(syncJobTable.status, "pending"), eq(syncJobTable.status, "running")),
          ),
        );

      const alreadyQueued = new Set(existing.map((r) => r.sourceCollectionId));
      const toEnqueue = sourceCollectionIds.filter((id) => !alreadyQueued.has(id));

      if (alreadyQueued.size > 0) {
        log.debug({ skippedCount: alreadyQueued.size }, "Sync jobs skipped (already queued)");
      }

      if (toEnqueue.length === 0) return 0;

      await db.insert(syncJobTable).values(
        toEnqueue.map((sourceCollectionId) => ({
          sourceCollectionId,
        })),
      );

      log.info({ count: toEnqueue.length, sourceCollectionIds: toEnqueue }, "Sync jobs enqueued");

      return toEnqueue.length;
    },
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.enqueue"));
