import { query } from "$app/server";
import {
  getLinkedAccounts,
  type LinkedAccount,
} from "@contfu/svc-backend/infra/auth/linked-accounts";
import { getUserId } from "$lib/server/user";

/**
 * Get all linked social accounts for the current user.
 */
export const listLinkedAccounts = query(async (): Promise<LinkedAccount[]> => {
  const userId = getUserId();
  return getLinkedAccounts(userId);
});
