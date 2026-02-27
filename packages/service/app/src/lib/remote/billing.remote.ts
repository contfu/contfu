import { query } from "$app/server";
import { getUserId } from "$lib/server/user";
import { db } from "@contfu/svc-backend/infra/db/db";
import { quotaTable, type Quota } from "@contfu/svc-backend/infra/db/schema";
import type { QuotaState } from "@contfu/svc-core";
import { getQuota as getQuotaFromKv } from "@contfu/svc-backend/infra/nats/quota-kv";
import { eq } from "drizzle-orm";

export const getQuota = query(async (): Promise<Quota | null> => {
  const userId = getUserId();
  const [quota] = await db.select().from(quotaTable).where(eq(quotaTable.id, userId)).limit(1);
  return quota ?? null;
});

export const getQuotaUsage = query(async (): Promise<QuotaState | null> => {
  const userId = getUserId();
  return getQuotaFromKv(userId);
});
