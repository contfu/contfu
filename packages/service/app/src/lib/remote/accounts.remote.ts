import { query } from "$app/server";
import { getLinkedAccounts, type LinkedAccount } from "$lib/server/auth/linked-accounts";
import { getUserId } from "$lib/server/auth/user";

/**
 * Get all linked social accounts for the current user.
 */
export const listLinkedAccounts = query(async (): Promise<LinkedAccount[]> => {
  const userId = getUserId();
  return getLinkedAccounts(userId);
});
