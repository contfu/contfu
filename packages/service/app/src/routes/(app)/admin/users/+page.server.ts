import { listUsers, updateUser } from "$lib/server/admin/users";
import { UserRole } from "$lib/server/db/schema";
import { error, fail } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => {
  // Only admins can access this page
  if (!locals.user || locals.user.role !== UserRole.ADMIN) {
    throw error(403, "Admin access required");
  }

  const users = await listUsers();
  return { users };
};

export const actions: Actions = {
  approve: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== UserRole.ADMIN) {
      throw error(403, "Admin access required");
    }

    const formData = await request.formData();
    const id = Number(formData.get("id"));

    if (!id) {
      return fail(400, { error: "User ID required" });
    }

    await updateUser({ id, approved: true });
    return { success: true };
  },

  revoke: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== UserRole.ADMIN) {
      throw error(403, "Admin access required");
    }

    const formData = await request.formData();
    const id = Number(formData.get("id"));

    if (!id) {
      return fail(400, { error: "User ID required" });
    }

    await updateUser({ id, approved: false });
    return { success: true };
  },

  makeAdmin: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== UserRole.ADMIN) {
      throw error(403, "Admin access required");
    }

    const formData = await request.formData();
    const id = Number(formData.get("id"));

    if (!id) {
      return fail(400, { error: "User ID required" });
    }

    await updateUser({ id, role: UserRole.ADMIN });
    return { success: true };
  },

  removeAdmin: async ({ request, locals }) => {
    if (!locals.user || locals.user.role !== UserRole.ADMIN) {
      throw error(403, "Admin access required");
    }

    const formData = await request.formData();
    const id = Number(formData.get("id"));

    if (!id) {
      return fail(400, { error: "User ID required" });
    }

    await updateUser({ id, role: UserRole.USER });
    return { success: true };
  },
};
