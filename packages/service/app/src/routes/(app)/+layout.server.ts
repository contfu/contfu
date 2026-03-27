import { UserRole } from "@contfu/svc-backend/domain/types";
import { PlanTier } from "@contfu/svc-backend/infra/polar/products";
import { db } from "@contfu/svc-backend/infra/db/db";
import { userTable } from "@contfu/svc-backend/infra/db/schema";
import { redirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ url, locals }) => {
  if (!locals.user) {
    throw redirect(302, "/login");
  }

  // Re-fetch user from DB to get current approval/role status
  // (session data may be stale after admin changes)
  const [freshUser] = await db
    .select({ approved: userTable.approved, role: userTable.role, basePlan: userTable.basePlan })
    .from(userTable)
    .where(eq(userTable.id, Number(locals.user.id)));

  const approved = freshUser?.approved ?? locals.user.approved;
  const role = freshUser?.role ?? locals.user.role;
  const basePlan = freshUser?.basePlan ?? PlanTier.FREE;

  // Update locals so downstream server functions (e.g. requireAdmin) see fresh values
  locals.user.approved = approved;
  locals.user.role = role;
  locals.user.basePlan = basePlan;

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
