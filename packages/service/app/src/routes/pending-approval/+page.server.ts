import { redirect } from "@sveltejs/kit";
import { db } from "@contfu/svc-backend/infra/db/db";
import { userTable } from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";

export async function load({ locals }) {
  // If not logged in, redirect to login
  if (!locals.session || !locals.user) {
    throw redirect(302, "/login");
  }

  // Re-fetch approval status from DB (may have been changed by admin)
  const [freshUser] = await db
    .select({ approved: userTable.approved })
    .from(userTable)
    .where(eq(userTable.id, Number(locals.user.id)));

  const approved = freshUser?.approved ?? locals.user.approved;

  // If approved, redirect to dashboard
  if (approved) {
    throw redirect(302, "/dashboard");
  }

  return {
    user: locals.user,
  };
}
