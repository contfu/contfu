import { extractWebAuthType, SourceType } from "@contfu/svc-core";
import { and, eq } from "drizzle-orm";
import type { BackendSource, UpdateSourceInput } from "../../domain/types";
import { encryptCredentials } from "../../infra/crypto/credentials";
import { db } from "../../infra/db/db";
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

  // Add webAuthType for web sources
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
    includeRef: input.includeRef,
    credentials: encryptedCredentials,
    webhookSecret: encryptedWebhookSecret,
    updatedAt: new Date(),
  };

  // Remove undefined keys to avoid overwriting with undefined
  const setValues = Object.fromEntries(
    Object.entries(encryptedUpdates).filter(([_, v]) => v !== undefined),
  );

  const [updated] = await db
    .update(sourceTable)
    .set(setValues)
    .where(and(eq(sourceTable.id, id), eq(sourceTable.userId, userId)))
    .returning();

  if (!updated) return undefined;

  return mapToBackendSource(updated);
}
