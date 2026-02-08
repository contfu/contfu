import { eq, sql } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";
import { syncJobTable } from "../../infra/db/schema";

/**
 * Mark a job as completed.
 *
 * @param db - Database connection (main thread or worker)
 * @param jobId - The job ID to complete
 */
export async function completeJob(
  db: PgAsyncDatabase<any, typeof schema, any>,
  jobId: number,
): Promise<void> {
  await db
    .update(syncJobTable)
    .set({
      status: "completed",
      completedAt: sql`now()`,
    })
    .where(eq(syncJobTable.id, jobId));
}
