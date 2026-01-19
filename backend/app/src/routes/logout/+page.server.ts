import type { Actions } from "./$types";
import { redirect } from "@sveltejs/kit";
import { SESSION_COOKIE_NAME, invalidateSession } from "$lib/server/auth/session";

export const actions: Actions = {
  default: async ({ cookies, locals }) => {
    if (locals.session?.id) {
      await invalidateSession(locals.session.id);
    }
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    redirect(302, "/login");
  },
};
