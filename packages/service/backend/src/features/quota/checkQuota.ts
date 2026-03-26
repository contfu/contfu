import { eq } from "drizzle-orm";
import type { QuotaState } from "@contfu/svc-core";
import { db } from "../../infra/db/db";
import { quotaTable } from "../../infra/db/schema";
import { publishCountDelta } from "../../infra/cache/quota-cache";
import { getQuota } from "./getQuota";

type CountField = "connections" | "collections" | "flows";

async function resetItemsIfPeriodExpired(userId: number): Promise<void> {
  const state = await getQuota(userId);
  if (state.periodEnd === 0 || Math.floor(Date.now() / 1000) < state.periodEnd) return;

  await db.update(quotaTable).set({ items: 0 }).where(eq(quotaTable.id, userId));
  publishCountDelta(userId, { items: -state.items });
}

export async function checkQuota(
  userId: number,
  field: CountField | "items",
): Promise<{ allowed: boolean; current: number; max: number }> {
  if (field === "items") {
    await resetItemsIfPeriodExpired(userId);
  }

  const state = await getQuota(userId);

  const maxField = `max${field.charAt(0).toUpperCase()}${field.slice(1)}` as keyof QuotaState;
  const current = state[field];
  const max = state[maxField];

  // -1 means unlimited, 0 means no hard cap (on-demand billing)
  if (max === -1 || max === 0) return { allowed: true, current, max };

  return { allowed: current < max, current, max };
}
