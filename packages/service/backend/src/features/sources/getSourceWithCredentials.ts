import { db } from "../../infra/db/db";
import { sourceTable, type Source } from "../../infra/db/schema";
import { decryptCredentials } from "../../infra/crypto/credentials";
import { and, eq } from "drizzle-orm";

/** Internal source with decrypted credentials - NEVER expose to app */
export type InternalSourceWithCredentials = Source & {
  credentials: Buffer | null;
  webhookSecret: Buffer | null;
};

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
