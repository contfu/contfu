import { UserRole } from "@contfu/svc-backend/domain/types";
import { PlanTier } from "@contfu/svc-backend/infra/polar/products";
import { redirect } from "@sveltejs/kit";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ url, locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  // locals.user is already refreshed from DB in hooks.server.ts
  const approved = locals.user.approved as boolean;
  const role = locals.user.role as number;
  const basePlan = (locals.user.basePlan as number) ?? PlanTier.FREE;

  // Redirect unapproved users to pending approval page
  // Exception: allow access to /admin for admins even if not approved
  const isAdmin = role === UserRole.ADMIN;
  const isAdminRoute = url.pathname.startsWith("/admin");

  if (!approved && !(isAdmin && isAdminRoute)) {
    throw redirect(302, "/pending-approval");
  }

  return {
    user: {
      ...locals.user,
      approved,
      role,
      basePlan,
    },
  };
};
