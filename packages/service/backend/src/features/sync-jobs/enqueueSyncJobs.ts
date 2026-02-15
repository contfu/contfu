import { and, inArray, or, eq } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Enqueue sync jobs for the given source collections.
 * Skips source collections that already have a pending or running job
 * to prevent duplicate work.
 *
 * @param db - Database connection (main thread or worker)
 * @param sourceCollectionIds - IDs of source collections to sync
 * @returns Number of jobs enqueued
 */
export async function enqueueSyncJobs(
  db: PgAsyncDatabase<any, typeof schema, any>,
  sourceCollectionIds: number[],
): Promise<number> {
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

  if (toEnqueue.length === 0) return 0;

  await db.insert(syncJobTable).values(
    toEnqueue.map((sourceCollectionId) => ({
      sourceCollectionId,
    })),
  );

  return toEnqueue.length;
}
