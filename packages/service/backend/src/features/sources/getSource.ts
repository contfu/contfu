import { extractWebAuthType } from "@contfu/svc-core";
import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import type { BackendSource } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { sourceTable, type Source } from "../../infra/db/schema";

/** Source type: Web (for extracting auth type) */
const SOURCE_TYPE_WEB = 2;

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

  if (source.type === SOURCE_TYPE_WEB) {
    return {
      ...baseSource,
      webAuthType: extractWebAuthType(source.credentials),
    };
  }

  return baseSource;
}

/**
 * Get a single source by ID.
 * Does NOT include credentials.
 * Returns undefined if not found or not owned by the user.
 */
export const getSource = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

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

    return mapToBackendSource(source);
  }).pipe(Effect.withSpan("sources.get", { attributes: { userId, sourceId: id } }));
