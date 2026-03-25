import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { CryptoError, DatabaseError } from "../../effect/errors";
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
 * @param job - The job's collectionId
 * @returns Configuration for executing the sync, or null if not found
 */
export const getJobConfig = (job: { collectionId: number }) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            userId: collectionTable.userId,
            connectionUserId: connectionTable.userId,
            connectionType: connectionTable.type,
            connectionUrl: connectionTable.url,
            credentials: connectionTable.credentials,
            collectionRef: collectionTable.ref,
            collectionId: collectionTable.id,
          })
          .from(collectionTable)
          .innerJoin(
            connectionTable,
            and(
              eq(collectionTable.connectionId, connectionTable.id),
              eq(collectionTable.userId, connectionTable.userId),
            ),
          )
          .where(eq(collectionTable.id, job.collectionId))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return null;

    const credentials = yield* Effect.tryPromise({
      try: async () => decryptCredentials(row.connectionUserId, row.credentials),
      catch: (cause) =>
        new CryptoError({
          cause: new Error(
            `Failed to decrypt credentials for collection ${row.collectionId}. Verify BETTER_AUTH_SECRET or reconnect the source.`,
            { cause },
          ),
          operation: "decrypt",
        }),
    });

    return {
      userId: row.userId,
      sourceType: row.connectionType,
      sourceUrl: row.connectionUrl,
      credentials,
      collectionRef: row.collectionRef,
      collectionId: row.collectionId,
    } satisfies JobConfig;
  }).pipe(Effect.withSpan("syncJobs.getJobConfig"));
