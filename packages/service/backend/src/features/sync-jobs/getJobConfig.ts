import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { DrizzleDb } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { collectionTable, connectionTable } from "../../infra/db/schema";
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
 * Read the collection and connection configuration needed to execute a sync job.
 * Joins collection with connection to get credentials and type,
 * and decrypts credentials.
 *
 * @param db - Database connection (main thread or worker)
 * @param job - The job's collectionId
 * @returns Configuration for executing the sync, or null if not found
 */
export const getJobConfig = (db: DrizzleDb, job: { collectionId: number }) =>
  Effect.tryPromise({
    try: async () => {
      const [row] = await db
        .select({
          userId: collectionTable.userId,
          connectionType: connectionTable.type,
          connectionUrl: connectionTable.url,
          credentials: connectionTable.credentials,
          collectionRef: collectionTable.ref,
          collectionId: collectionTable.id,
        })
        .from(collectionTable)
        .innerJoin(connectionTable, eq(collectionTable.connectionId, connectionTable.id))
        .where(eq(collectionTable.id, job.collectionId))
        .limit(1);

      if (!row) return null;

      return {
        userId: row.userId,
        sourceType: row.connectionType,
        sourceUrl: row.connectionUrl,
        credentials: await decryptCredentials(row.userId, row.credentials),
        collectionRef: row.collectionRef,
        collectionId: row.collectionId,
      } satisfies JobConfig;
    },
    catch: (e) => new DatabaseError({ cause: e }),
  }).pipe(Effect.withSpan("syncJobs.getJobConfig"));
