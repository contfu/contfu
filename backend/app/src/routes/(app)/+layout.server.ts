import type { LayoutServerLoad } from "./$types";
import { guardLoggedIn } from "$lib/server/auth/session";

export const load: LayoutServerLoad = async ({ locals }) => {
  guardLoggedIn(locals);
};
