import { db } from "../../infra/db/db";
import { sourceCollectionTable, sourceTable, type Source } from "../../infra/db/schema";
import { eq, sql } from "drizzle-orm";
import type { BackendSource, BackendSourceWithCollectionCount } from "../../domain/types";

/** Source type: Web (for extracting auth type) */
const SOURCE_TYPE_WEB = 2;

/**
 * Extract the web auth type from credentials buffer.
 * For web sources, the first byte is the auth type: 0=None, 1=Bearer, 2=Basic
 */
function extractWebAuthType(credentials: Buffer | null): number {
  if (!credentials || credentials.length === 0) return 0;
  return credentials[0];
}

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
export async function listSources(userId: number): Promise<BackendSourceWithCollectionCount[]> {
  const sources = await db
    .select()
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .orderBy(sourceTable.createdAt);

  const collectionCounts = await db
    .select({
      sourceId: sourceCollectionTable.sourceId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(sourceCollectionTable)
    .where(eq(sourceCollectionTable.userId, userId))
    .groupBy(sourceCollectionTable.sourceId);

  const countMap = new Map<number, number>(collectionCounts.map((c) => [c.sourceId, c.count]));

  return sources.map((source) =>
    mapToBackendSourceWithCollectionCount(source, countMap.get(source.id) ?? 0),
  );
}
