import { db } from "../../infra/db/db";
import { sourceTable, type Source } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { BackendSource } from "../../domain/types";

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
  const baseSource = {
    id: source.id,
    uid: source.uid,
    userId: source.userId,
    name: source.name,
    url: source.url,
    type: source.type,
    hasCredentials: source.credentials !== null,
    hasWebhookSecret: source.webhookSecret !== null,
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

/**
 * Get a single source by ID.
 * Does NOT include credentials.
 */
export async function getSource(userId: number, id: number): Promise<BackendSource | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  if (!source) return undefined;

  return mapToBackendSource(source);
}
