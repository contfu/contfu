import type { LayoutServerLoad, Actions } from "./$types";
import { redirect } from "@sveltejs/kit";
import { SESSION_COOKIE_NAME, invalidateSession } from "$lib/server/auth/session";

export const load: LayoutServerLoad = async ({ locals }) => {
  const isUnderConstruction = !process.env.STRIPE_TEST_KEY && !process.env.STRIPE_KEY;
  const user = locals.session?.user;

  return {
    user: user ? { email: user.email, name: user.name, image: user.image } : null,
    isUnderConstruction,
  };
};

export const actions: Actions = {
  logout: async ({ cookies, locals }) => {
    if (locals.session?.id) {
      await invalidateSession(locals.session.id);
    }
    cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
    throw redirect(302, "/login");
  },
};
