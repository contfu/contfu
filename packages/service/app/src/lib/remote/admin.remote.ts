import { form, query } from "$app/server";
import { run } from "$lib/server/run";
import { getUser } from "$lib/server/user";
import type { BackendUserSummary } from "@contfu/svc-backend/domain/types";
import { UserRole } from "@contfu/svc-backend/domain/types";
import { getSetting } from "@contfu/svc-backend/features/admin/getSetting";
import { listUsers } from "@contfu/svc-backend/features/admin/listUsers";
import { updateUser } from "@contfu/svc-backend/features/admin/updateUser";
import { decryptCredentials } from "@contfu/svc-backend/infra/crypto/credentials";
import { error, invalid } from "@sveltejs/kit";
import * as v from "valibot";

/**
 * Ensures the current user is an admin.
 * Throws an HTTP 403 error if not.
 */
function requireAdmin() {
  const user = getUser();
  if (user.role !== UserRole.ADMIN) {
    error(403, "Admin access required");
  }
  return user;
}

/**
 * Get all users (admin only).
 */
export const getUsers = query(async (): Promise<BackendUserSummary[]> => {
  requireAdmin();
  return run(listUsers());
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

    const result = await run(updateUser({ id: data.id, approved: true }));
    if (!result) {
      invalid(issue.id("User not found"));
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

    const result = await run(updateUser({ id: data.id, approved: false }));
    if (!result) {
      invalid(issue.id("User not found"));
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

    const result = await run(updateUser({ id: data.id, role: UserRole.ADMIN }));
    if (!result) {
      invalid(issue.id("User not found"));
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

    const result = await run(updateUser({ id: data.id, role: UserRole.USER }));
    if (!result) {
      invalid(issue.id("User not found"));
    }

    return { success: true };
  },
);

// ============================================================
// System Settings
// ============================================================

export interface SystemSettings {
  notionOAuthVerificationToken: string | null;
}

/**
 * Get system settings (admin only).
 */
export const getSystemSettings = query(async (): Promise<SystemSettings> => {
  requireAdmin();

  const encrypted = await run(getSetting("notion_oauth_verification_token"));
  let notionOAuthVerificationToken: string | null = null;
  if (encrypted) {
    const decrypted = await decryptCredentials(0, encrypted);
    notionOAuthVerificationToken = decrypted?.toString("utf8") ?? null;
  }

  return { notionOAuthVerificationToken };
});
