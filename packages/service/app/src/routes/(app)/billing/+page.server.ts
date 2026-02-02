import type { PageServerLoad } from "./$types";
import { db } from "@contfu/svc-backend/infra/db/db";
import { quotaTable } from "@contfu/svc-backend/infra/db/schema";
import { eq } from "drizzle-orm";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return { quota: null };
  }

  const quotas = await db
    .select()
    .from(quotaTable)
    .where(eq(quotaTable.id, Number(locals.user.id)))
    .limit(1);

  return {
    quota: quotas[0] ?? null,
  };
};
