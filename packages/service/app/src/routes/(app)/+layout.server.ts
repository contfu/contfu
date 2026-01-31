import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: LayoutServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  // Redirect unapproved users to pending approval page
  // Exception: allow access to /admin for admins (role=1) even if not approved
  const isAdmin = locals.user.role === 1;
  const isAdminRoute = url.pathname.startsWith("/admin");

  if (!locals.user.approved && !(isAdmin && isAdminRoute)) {
    throw redirect(302, "/pending-approval");
  }

  return {
    user: locals.user,
  };
};
