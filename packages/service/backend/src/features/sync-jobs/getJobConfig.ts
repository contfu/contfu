import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { integrationTable, sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { decryptCredentials } from "../../infra/crypto/credentials";

export interface JobConfig {
  userId: number;
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
 * @param job - The job's sourceCollectionId
 * @returns Configuration for executing the sync, or null if not found
 */
export const getJobConfig = (db: DrizzleDb, job: { sourceCollectionId: number }) =>
  Effect.tryPromise({
    try: async () => {
      const [row] = await db
        .select({
          userId: sourceCollectionTable.userId,
          sourceType: sourceTable.type,
          sourceUrl: sourceTable.url,
          credentials: sourceTable.credentials,
          integrationCredentials: integrationTable.credentials,
          collectionRef: sourceCollectionTable.ref,
          collectionId: sourceCollectionTable.id,
        })
        .from(sourceCollectionTable)
        .innerJoin(sourceTable, eq(sourceCollectionTable.sourceId, sourceTable.id))
        .leftJoin(integrationTable, eq(sourceTable.integrationId, integrationTable.id))
        .where(eq(sourceCollectionTable.id, job.sourceCollectionId))
        .limit(1);

      if (!row) return null;

      const encryptedCreds = row.credentials ?? row.integrationCredentials;
      return {
        userId: row.userId,
        sourceType: row.sourceType,
        sourceUrl: row.sourceUrl,
        credentials: await decryptCredentials(row.userId, encryptedCreds),
        collectionRef: row.collectionRef,
        collectionId: row.collectionId,
      } satisfies JobConfig;
    },
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.getJobConfig"));
