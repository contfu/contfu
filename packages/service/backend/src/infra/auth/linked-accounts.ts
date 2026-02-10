import { db } from "../db/db";
import { accountTable } from "../db/schema";
import { and, eq } from "drizzle-orm";

export type LinkedAccount = {
  providerId: string;
  hasAccessToken: boolean;
};

/**
 * Get all linked social accounts for a user.
 */
export async function getLinkedAccounts(userId: number): Promise<LinkedAccount[]> {
  const accounts = await db
    .select({
      providerId: accountTable.providerId,
      accessToken: accountTable.accessToken,
    })
    .from(accountTable)
    .where(eq(accountTable.userId, userId));

  return accounts.map((acc) => ({
    providerId: acc.providerId,
    hasAccessToken: !!acc.accessToken,
  }));
}

/**
 * Check if a user has a specific provider linked.
 */
export async function hasLinkedProvider(userId: number, providerId: string): Promise<boolean> {
  const [account] = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, providerId)))
    .limit(1);

  return !!account;
}

/**
 * Get the access token for a linked provider.
 * Returns null if the provider is not linked or has no token.
 */
export async function getProviderAccessToken(
  userId: number,
  providerId: string,
): Promise<string | null> {
  const [account] = await db
    .select({ accessToken: accountTable.accessToken })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, providerId)))
    .limit(1);
  return account?.accessToken ?? null;
}
