import { db } from "../../infra/db/db";
import { sourceTable, type Source } from "../../infra/db/schema";
import { encryptCredentials } from "../../infra/crypto/credentials";
import { and, eq, sql } from "drizzle-orm";
import type { BackendSource, UpdateSourceInput } from "../../domain/types";

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
 * Update a source.
 * Credentials and webhookSecret are encrypted before storage.
 *
 * @returns The updated source without credentials
 */
export async function updateSource(
  userId: number,
  id: number,
  input: UpdateSourceInput,
): Promise<BackendSource | undefined> {
  // Encrypt credentials and webhookSecret if being updated
  const [encryptedCredentials, encryptedWebhookSecret] = await Promise.all([
    input.credentials ? encryptCredentials(userId, input.credentials) : undefined,
    input.webhookSecret !== undefined ? encryptCredentials(userId, input.webhookSecret) : undefined,
  ]);

  const encryptedUpdates = {
    name: input.name,
    url: input.url,
    credentials: encryptedCredentials,
    webhookSecret: encryptedWebhookSecret,
    updatedAt: sql`(unixepoch())`,
  };

  // Remove undefined keys to avoid overwriting with undefined
  const setValues = Object.fromEntries(
    Object.entries(encryptedUpdates).filter(([_, v]) => v !== undefined),
  );

  const [updated] = await db
    .update(sourceTable)
    .set(setValues)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendSource(updated);
}
