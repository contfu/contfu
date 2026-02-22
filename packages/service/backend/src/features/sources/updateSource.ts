import { extractWebAuthType, SourceType } from "@contfu/svc-core";
import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import type { BackendSource, UpdateSourceInput } from "../../domain/types";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { sourceTable, type Source } from "../../infra/db/schema";

function mapToBackendSource(source: Source): BackendSource {
  const baseSource: BackendSource = {
    id: source.id,
    uid: source.uid,
    userId: source.userId,
    name: source.name,
    url: source.url,
    includeRef: source.includeRef,
    type: source.type,
    hasCredentials: source.credentials !== null,
    hasWebhookSecret: source.webhookSecret !== null,
    credentialsSource: source.credentialsSource,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };

  if (source.type === SourceType.WEB) {
    return {
      ...baseSource,
      webAuthType: extractWebAuthType(source.credentials),
    };
  }

  return baseSource;
}

/**
 * Update a source.
 * Credentials and webhookSecret are encrypted before storage.
 * Returns undefined if not found or not owned by the user.
 *
 * @returns The updated source without credentials
 */
export const updateSource = (userId: number, id: number, input: UpdateSourceInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    // Encrypt credentials and webhookSecret if being updated
    const [encryptedCredentials, encryptedWebhookSecret] = yield* Effect.all([
      input.credentials
        ? cryptoService.encryptCredentials(userId, input.credentials)
        : Effect.succeed(undefined),
      input.webhookSecret !== undefined
        ? cryptoService.encryptCredentials(userId, input.webhookSecret)
        : Effect.succeed(undefined),
    ]);

    const encryptedUpdates = {
      name: input.name,
      url: input.url,
      includeRef: input.includeRef,
      credentials: encryptedCredentials,
      webhookSecret: encryptedWebhookSecret,
      updatedAt: new Date(),
    };

    // Remove undefined keys to avoid overwriting with undefined
    const setValues = Object.fromEntries(
      Object.entries(encryptedUpdates).filter(([_, v]) => v !== undefined),
    );

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(sourceTable)
          .set(setValues)
          .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendSource(updated);
  }).pipe(Effect.withSpan("sources.update", { attributes: { userId, sourceId: id } }));
