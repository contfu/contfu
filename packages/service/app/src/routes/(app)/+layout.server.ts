import type { LayoutServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { UserRole } from "$lib/server/auth/user";

export const load: LayoutServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  // Redirect unapproved users to pending approval page
  // Exception: allow access to /admin for admins even if not approved
  const isAdmin = locals.user.role === UserRole.ADMIN;
  const isAdminRoute = url.pathname.startsWith("/admin");

  if (!locals.user.approved && !(isAdmin && isAdminRoute)) {
    throw redirect(302, "/pending-approval");
  }

  return {
    user: locals.user,
  };
};
