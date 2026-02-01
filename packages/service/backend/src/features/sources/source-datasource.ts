import { db } from "../../infra/db/db";
import { collectionTable, sourceTable, type Source } from "../../infra/db/schema";
import { decryptCredentials, encryptCredentials } from "../../infra/crypto/credentials";
import { and, eq, sql } from "drizzle-orm";

export type NewSource = {
  name: string;
  type: number;
  url?: string | null;
  credentials: Buffer | null;
  webhookSecret?: Buffer | null;
};

export type SourceUpdate = {
  name?: string;
  url?: string | null;
  credentials?: Buffer;
  webhookSecret?: Buffer | null;
};

export type SourceWithCollectionCount = Source & {
  collectionCount: number;
};

/**
 * Insert a new source for a user.
 * The ID is auto-generated as max(id) + 1 within the user's sources.
 * Credentials and webhookSecret are encrypted before storage.
 */
export async function insertSource(userId: number, source: NewSource): Promise<Source> {
  const maxIdResult = await db
    .select({ maxId: sql<number>`coalesce(max(id), 0)` })
    .from(sourceTable)
    .where(eq(sourceTable.userId, userId))
    .limit(1);

  const nextId = (maxIdResult[0]?.maxId ?? 0) + 1;

  // Encrypt credentials and webhookSecret before storage
  const [encryptedCredentials, encryptedWebhookSecret] = await Promise.all([
    encryptCredentials(userId, source.credentials),
    encryptCredentials(userId, source.webhookSecret),
  ]);

  const [inserted] = await db
    .insert(sourceTable)
    .values({
      userId,
      id: nextId,
      name: source.name,
      type: source.type,
      url: source.url ?? null,
      credentials: encryptedCredentials,
      webhookSecret: encryptedWebhookSecret,
    })
    .returning();

  // Return with decrypted values for immediate use
  return {
    ...inserted,
    credentials: source.credentials,
    webhookSecret: source.webhookSecret ?? null,
  };
}

/**
 * Get all sources for a user with collection counts.
 * Credentials are decrypted on retrieval.
 */
export async function selectSources(userId: number): Promise<SourceWithCollectionCount[]> {
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
    collectionCounts.map((c: { sourceId: number; count: number }) => [c.sourceId, c.count]),
  );

  // Decrypt credentials and webhookSecret for each source
  const decryptedSources = await Promise.all(
    sources.map(async (source: Source): Promise<SourceWithCollectionCount> => {
      const [credentials, webhookSecret] = await Promise.all([
        decryptCredentials(userId, source.credentials),
        decryptCredentials(userId, source.webhookSecret),
      ]);
      return {
        ...source,
        credentials,
        webhookSecret,
        collectionCount: countMap.get(source.id) ?? 0,
      };
    }),
  );

  return decryptedSources;
}

/**
 * Get a single source by ID.
 * Credentials and webhookSecret are decrypted on retrieval.
 */
export async function selectSource(userId: number, id: number): Promise<Source | undefined> {
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

/**
 * Get a single source by ID with collection count.
 * Credentials and webhookSecret are decrypted on retrieval.
 */
export async function selectSourceWithCollectionCount(
  userId: number,
  id: number,
): Promise<SourceWithCollectionCount | undefined> {
  const [source] = await db
    .select()
    .from(sourceTable)
    .where(and(eq(sourceTable.userId, userId), eq(sourceTable.id, id)))
    .limit(1);

  if (!source) return undefined;

  const [[countResult], credentials, webhookSecret] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTable)
      .where(and(eq(collectionTable.userId, userId), eq(collectionTable.sourceId, id))),
    decryptCredentials(userId, source.credentials),
    decryptCredentials(userId, source.webhookSecret),
  ]);

  return {
    ...source,
    credentials,
    webhookSecret,
    collectionCount: countResult?.count ?? 0,
  };
}

/**
 * Update a source.
 * Credentials and webhookSecret are encrypted before storage.
 */
export async function updateSource(
  userId: number,
  id: number,
  updates: SourceUpdate,
): Promise<Source | undefined> {
  // Encrypt credentials and webhookSecret if being updated
  const [encryptedCredentials, encryptedWebhookSecret] = await Promise.all([
    updates.credentials ? encryptCredentials(userId, updates.credentials) : undefined,
    updates.webhookSecret !== undefined
      ? encryptCredentials(userId, updates.webhookSecret)
      : undefined,
  ]);

  const encryptedUpdates = {
    name: updates.name,
    url: updates.url,
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

  // Return with decrypted values
  const [credentials, webhookSecret] = await Promise.all([
    updates.credentials ?? decryptCredentials(userId, updated.credentials),
    updates.webhookSecret !== undefined
      ? updates.webhookSecret
      : decryptCredentials(userId, updated.webhookSecret),
  ]);

  return {
    ...updated,
    credentials,
    webhookSecret,
  };
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
