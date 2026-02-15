import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ locals }) => {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    throw redirect(302, "/under-construction");
  }

  if (locals.user) {
    throw redirect(302, "/dashboard");
  }

  return {
    user: locals.user,
  };
};
