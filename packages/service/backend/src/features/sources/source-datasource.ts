import { db } from "../../infra/db/db";
import { collectionTable, sourceTable, type Source } from "../../infra/db/schema";
import { decryptCredentials, encryptCredentials } from "../../infra/crypto/credentials";
import { and, eq, sql } from "drizzle-orm";
import type {
  BackendSource,
  BackendSourceWithCollectionCount,
  CreateSourceInput,
  UpdateSourceInput,
} from "../../domain/types";

// =============================================================================
// Internal Types (not exported to app)
// =============================================================================

/** Internal source with decrypted credentials - NEVER expose to app */
type InternalSourceWithCredentials = Source & {
  credentials: Buffer | null;
  webhookSecret: Buffer | null;
};

// =============================================================================
// Constants
// =============================================================================

/** Source type: Web (for extracting auth type) */
const SOURCE_TYPE_WEB = 2;

// =============================================================================
// Mappers (DB → Domain)
// =============================================================================

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

function mapToBackendSourceWithCollectionCount(
  source: Source,
  collectionCount: number,
): BackendSourceWithCollectionCount {
  return {
    ...mapToBackendSource(source),
    collectionCount,
  };
}

// =============================================================================
// Public Feature Functions (return domain types, no credentials)
// =============================================================================

/**
 * Create a new source for a user.
 * The ID is auto-generated as max(id) + 1 within the user's sources.
 * Credentials and webhookSecret are encrypted before storage.
 *
 * @returns The created source without credentials
 */
export async function createSource(
  userId: number,
  input: CreateSourceInput,
): Promise<BackendSource> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  // Encrypt credentials and webhookSecret before storage
  const [encryptedCredentials, encryptedWebhookSecret] = await Promise.all([
    encryptCredentials(userId, input.credentials ?? null),
    encryptCredentials(userId, input.webhookSecret ?? null),
  ]);

  const [inserted] = await db
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

  return mapToBackendSource(inserted);
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
      sourceId: collectionTable.sourceId,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(collectionTable)
    .where(eq(collectionTable.userId, userId))
    .groupBy(collectionTable.sourceId);

  const countMap = new Map<number, number>(
    collectionCounts.map((c) => [c.sourceId, c.count]),
  );

  return sources.map((source) =>
    mapToBackendSourceWithCollectionCount(source, countMap.get(source.id) ?? 0),
  );
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

/**
 * Get a single source by ID with collection count.
 * Does NOT include credentials.
 */
export async function getSourceWithCollectionCount(
  userId: number,
  id: number,
): Promise<BackendSourceWithCollectionCount | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  if (!source) return undefined;

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, id)));

  return mapToBackendSourceWithCollectionCount(source, countResult?.count ?? 0);
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
    input.webhookSecret !== undefined
      ? encryptCredentials(userId, input.webhookSecret)
      : undefined,
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

/**
 * Delete a source. Collections will cascade delete.
 */
export async function deleteSource(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .returning();

  return result.length > 0;
}

// =============================================================================
// Internal Functions (with credentials - for internal backend use only)
// =============================================================================

/**
 * Get a source with decrypted credentials.
 * INTERNAL USE ONLY - never expose to the SvelteKit app.
 *
 * Used by sync workers and webhook handlers that need actual credentials.
 */
export async function getSourceWithCredentials(
  userId: number,
  id: number,
): Promise<InternalSourceWithCredentials | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  if (!source) return undefined;

  const [credentials, webhookSecret] = await Promise.all([
    decryptCredentials(userId, source.credentials),
    decryptCredentials(userId, source.webhookSecret),
  ]);

  return {
    ...source,
    credentials,
    webhookSecret,
  };
}

// =============================================================================
// Legacy exports (deprecated - use new function names)
// =============================================================================

/** @deprecated Use createSource instead */
export const insertSource = createSource;

/** @deprecated Use listSources instead */
export const selectSources = listSources;

/** @deprecated Use getSource instead */
export const selectSource = getSource;

/** @deprecated Use getSourceWithCollectionCount instead */
export const selectSourceWithCollectionCount = getSourceWithCollectionCount;

// Re-export types for convenience
export type { BackendSource, BackendSourceWithCollectionCount } from "../../domain/types";

// Legacy type aliases for backwards compatibility
export type NewSource = CreateSourceInput;
export type SourceUpdate = UpdateSourceInput;
export type SourceWithCollectionCount = BackendSourceWithCollectionCount;
