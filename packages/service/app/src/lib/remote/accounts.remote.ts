import { query, getRequestEvent } from "$app/server";
import { redirect } from "@sveltejs/kit";
import { getLinkedAccounts, type LinkedAccount } from "$lib/server/auth/linked-accounts";

function getUserId(): string {
  const event = getRequestEvent();
  const user = event.locals.user;
  if (!user) {
    throw redirect(302, "/login");
  }
  return user.id;
}

/**
 * Get all linked social accounts for the current user.
 */
export const listLinkedAccounts = query(async (): Promise<LinkedAccount[]> => {
  const userId = getUserId();
  return getLinkedAccounts(userId);
});
