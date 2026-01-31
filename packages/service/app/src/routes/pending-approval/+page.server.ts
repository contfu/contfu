import { redirect } from "@sveltejs/kit";

export async function load({ locals }) {
  // If not logged in, redirect to login
  if (!locals.session || !locals.user) {
    throw redirect(302, "/login");
  }

  // If already approved, redirect to dashboard
  if (locals.user.approved) {
    throw redirect(302, "/dashboard");
  }

  return {
    user: locals.user,
  };
}
