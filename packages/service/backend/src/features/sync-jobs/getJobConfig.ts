import { and, eq } from "drizzle-orm";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";
import { sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { decryptCredentials } from "../../infra/crypto/credentials";

export interface JobConfig {
  sourceType: number;
  sourceUrl: string | null;
  credentials: Buffer | null;
  collectionRef: Buffer | null;
  collectionId: number;
}

/**
 * Read the source and collection configuration needed to execute a sync job.
 * Joins source_collection with source to get connection details,
 * and decrypts credentials.
 *
 * @param db - Database connection (main thread or worker)
 * @param job - The job's userId and sourceCollectionId
 * @returns Configuration for executing the sync, or null if not found
 */
export async function getJobConfig(
  db: PgAsyncDatabase<any, typeof schema, any>,
  job: { userId: number; sourceCollectionId: number },
): Promise<JobConfig | null> {
  const [row] = await db
    .select({
      sourceType: sourceTable.type,
      sourceUrl: sourceTable.url,
      credentials: sourceTable.credentials,
      collectionRef: sourceCollectionTable.ref,
      collectionId: sourceCollectionTable.id,
    })
    .from(sourceCollectionTable)
    .innerJoin(
      sourceTable,
      and(
        eq(sourceCollectionTable.userId, sourceTable.userId),
        eq(sourceCollectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(
      and(
        eq(sourceCollectionTable.userId, job.userId),
        eq(sourceCollectionTable.id, job.sourceCollectionId),
      ),
    )
    .limit(1);

  if (!row) return null;

  return {
    sourceType: row.sourceType,
    sourceUrl: row.sourceUrl,
    credentials: await decryptCredentials(job.userId, row.credentials),
    collectionRef: row.collectionRef,
    collectionId: row.collectionId,
  };
}
