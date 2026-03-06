import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { Crypto } from "../../effect/services/Crypto";
import { DatabaseError } from "../../effect/errors";
import { integrationTable, sourceTable, type Source } from "../../infra/db/schema";

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
 * When the source has an integrationId and no inline credentials,
 * credentials are resolved from the linked integration.
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

    let credentials: Buffer | null;

    if (source.credentials) {
      // Source has inline credentials — decrypt them
      credentials = yield* cryptoService.decryptCredentials(source.userId, source.credentials);
    } else if (source.integrationId) {
      // Resolve credentials from linked integration
      const [integration] = yield* Effect.tryPromise({
        try: () =>
          db
            .select({ credentials: integrationTable.credentials })
            .from(integrationTable)
            .where(
              and(
                eq(integrationTable.id, source.integrationId!),
                eq(integrationTable.userId, userId),
              ),
            )
            .limit(1),
        catch: (e) => new DatabaseError({ cause: e }),
      });

      credentials = integration
        ? yield* cryptoService.decryptCredentials(userId, integration.credentials)
        : null;
    } else {
      credentials = null;
    }

    const webhookSecret = yield* cryptoService.decryptCredentials(
      source.userId,
      source.webhookSecret,
    );

    return {
      ...source,
      credentials,
      webhookSecret,
    } as InternalSourceWithCredentials;
  }).pipe(Effect.withSpan("sources.getWithCredentials", { attributes: { userId, sourceId: id } }));
