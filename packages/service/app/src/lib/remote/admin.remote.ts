import { form, query } from "$app/server";
import { listUsers, type UserSummary } from "@contfu/svc-backend/features/admin/listUsers";
import { updateUser } from "@contfu/svc-backend/features/admin/updateUser";
import { getUser } from "$lib/server/user";
import { UserRole } from "@contfu/svc-backend/infra/db/constants";
import { error, invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Ensures the current user is an admin.
 * Throws an HTTP 403 error if not.
 */
function requireAdmin() {
  const user = getUser();
  if (user.role !== UserRole.ADMIN) {
    throw error(403, "Admin access required");
  }
  return user;
}

/**
 * Get all users (admin only).
 */
export const getUsers = query(async (): Promise<UserSummary[]> => {
  requireAdmin();
  return listUsers();
});

/**
 * Approve a user (admin only).
 */
export const approveUser = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.pipe(v.number(), v.integer(), v.minValue(1)),
    ),
  }),
  async (data, issue) => {
    requireAdmin();

    const result = await updateUser({ id: data.id, approved: true });
    if (!result) {
      throw invalid(issue.id("User not found"));
    }

    return { success: true };
  },
);

/**
 * Revoke a user's approval (admin only).
 */
export const revokeUser = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.pipe(v.number(), v.integer(), v.minValue(1)),
    ),
  }),
  async (data, issue) => {
    requireAdmin();

    const result = await updateUser({ id: data.id, approved: false });
    if (!result) {
      throw invalid(issue.id("User not found"));
    }

    return { success: true };
  },
);

/**
 * Promote a user to admin (admin only).
 */
export const promoteToAdmin = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.pipe(v.number(), v.integer(), v.minValue(1)),
    ),
  }),
  async (data, issue) => {
    requireAdmin();

    const result = await updateUser({ id: data.id, role: UserRole.ADMIN });
    if (!result) {
      throw invalid(issue.id("User not found"));
    }

    return { success: true };
  },
);

/**
 * Demote an admin to regular user (admin only).
 */
export const demoteFromAdmin = form(
  v.object({
    id: v.pipe(
      v.union([v.string(), v.number()]),
      v.transform((val) => (typeof val === "string" ? Number.parseInt(val, 10) : val)),
      v.pipe(v.number(), v.integer(), v.minValue(1)),
    ),
  }),
  async (data, issue) => {
    requireAdmin();

    const result = await updateUser({ id: data.id, role: UserRole.USER });
    if (!result) {
      throw invalid(issue.id("User not found"));
    }

    return { success: true };
  },
);
