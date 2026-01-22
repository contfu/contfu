import type { PageServerLoad } from "./$types";
import { db } from "$lib/server/db/db";
import { quotaTable } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { quota: null };
  }

  const quotas = await db
    .select()
    .from(quotaTable)
    .where(eq(quotaTable.id, locals.user.id))
    .limit(1);

  return {
    quota: quotas[0] ?? null,
  };
};
