import { extractWebAuthType } from "@contfu/svc-core";
import { Effect } from "effect";
import { eq, sql } from "drizzle-orm";
import type { BackendSource, BackendSourceWithCollectionCount } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { sourceCollectionTable, sourceTable, type Source } from "../../infra/db/schema";

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
    integrationId: source.integrationId,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };

  // Add webAuthType for web sources
  if (source.type === SOURCE_TYPE_WEB) {
    return {
      ...baseSource,
      webAuthType: extractWebAuthType(source.credentials),
    };
  }

  return baseSource;
}

function mapToBackendSourceWithCollectionCount(
  source: Source,
  collectionCount: number,
): BackendSourceWithCollectionCount {
  return {
    ...mapToBackendSource(source),
    collectionCount,
  };
}

/**
 * Get all sources for a user with collection counts.
 * Does NOT include credentials.
 */
export const listSources = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const sources = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(sourceTable)
          .where(eq(sourceTable.userId, userId))
          .orderBy(sourceTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const collectionCounts = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            sourceId: sourceCollectionTable.sourceId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(sourceCollectionTable)
          .where(eq(sourceCollectionTable.userId, userId))
          .groupBy(sourceCollectionTable.sourceId),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const countMap = new Map<number, number>(collectionCounts.map((c) => [c.sourceId, c.count]));

    return sources.map((source) =>
      mapToBackendSourceWithCollectionCount(source, countMap.get(source.id) ?? 0),
    );
  }).pipe(Effect.withSpan("sources.list", { attributes: { userId } }));
