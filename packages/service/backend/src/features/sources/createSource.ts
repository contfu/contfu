import { db } from "../../infra/db/db";
import { sourceTable, type Source } from "../../infra/db/schema";
import { encryptCredentials } from "../../infra/crypto/credentials";
import { eq, sql } from "drizzle-orm";
import type { BackendSource, CreateSourceInput } from "../../domain/types";

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
 * Create a new source for a user.
 * The ID is auto-generated as max(id) + 1 within the user's sources.
 * Credentials and webhookSecret are encrypted before storage.
 * Uses a transaction to prevent race conditions in ID generation.
 *
 * @returns The created source without credentials
 */
export async function createSource(
  userId: number,
  input: CreateSourceInput,
): Promise<BackendSource> {
  // Encrypt credentials and webhookSecret before transaction
  const [encryptedCredentials, encryptedWebhookSecret] = await Promise.all([
    encryptCredentials(userId, input.credentials ?? null),
    encryptCredentials(userId, input.webhookSecret ?? null),
  ]);

  // Use transaction to atomically generate ID and insert
  const inserted = await db.transaction(async (tx) => {
    const maxIdResult = await tx
      .select({ maxId: sql<number>`coalesce(max(id), 0)` })
      .from(sourceTable)
      .where(eq(sourceTable.userId, userId))
      .limit(1);

    const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

    const [result] = await tx
      .insert(sourceTable)
      .values({
        userId,
        id: nextId,
        name: input.name,
        type: input.type,
        url: input.url ?? null,
        credentials: encryptedCredentials,
        webhookSecret: encryptedWebhookSecret,
      })
      .returning();

    return result;
  });

  return mapToBackendSource(inserted);
}
