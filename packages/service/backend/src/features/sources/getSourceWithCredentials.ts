import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { Crypto } from "../../effect/services/Crypto";
import { DatabaseError } from "../../effect/errors";
import { sourceTable, type Source } from "../../infra/db/schema";

/** Internal source with decrypted credentials - NEVER expose to app */
export type InternalSourceWithCredentials = Source & {
  credentials: Buffer | null;
  webhookSecret: Buffer | null;
};

/**
 * Get a source with decrypted credentials.
 * INTERNAL USE ONLY - never expose to the SvelteKit app.
 *
 * Used by sync workers and webhook handlers that need actual credentials.
 * Returns undefined if not found or not owned by the user.
 */
export const getSourceWithCredentials = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    const [source] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceTable)
          .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!source) return undefined;

    const [credentials, webhookSecret] = yield* Effect.all([
      cryptoService.decryptCredentials(source.userId, source.credentials),
      cryptoService.decryptCredentials(source.userId, source.webhookSecret),
    ]);

    return {
      ...source,
      credentials,
      webhookSecret,
    } as InternalSourceWithCredentials;
  }).pipe(Effect.withSpan("sources.getWithCredentials", { attributes: { userId, sourceId: id } }));
