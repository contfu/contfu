import { extractWebAuthType } from "@contfu/svc-core";
import { and, eq } from "drizzle-orm";
import type { BackendSource } from "../../domain/types";
import { db } from "../../infra/db/db";
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
 * Returns undefined if not found or not owned by the user.
 */
export async function getSource(userId: number, id: number): Promise<BackendSource | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
    .limit(1);

  if (!source) return undefined;

  return mapToBackendSource(source);
}
