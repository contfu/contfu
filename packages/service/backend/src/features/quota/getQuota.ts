import { eq, count } from "drizzle-orm";
import type { QuotaState } from "@contfu/svc-core";
import { FREE_QUOTA } from "../../infra/polar/products";
import { db } from "../../infra/db/db";
import { connectionTable, collectionTable, flowTable, quotaTable } from "../../infra/db/schema";
import { getCachedQuota, setCachedQuota } from "../../infra/cache/quota-cache";

function periodEndToTimestamp(periodEnd: Date | null): number {
  return periodEnd ? Math.floor(periodEnd.getTime() / 1000) : 0;
}

async function countFromDb(
  userId: number,
): Promise<{ connections: number; collections: number; flows: number }> {
  const [[connRow], [colRow], [flowRow]] = await Promise.all([
    db.select({ c: count() }).from(connectionTable).where(eq(connectionTable.userId, userId)),
    db.select({ c: count() }).from(collectionTable).where(eq(collectionTable.userId, userId)),
    db.select({ c: count() }).from(flowTable).where(eq(flowTable.userId, userId)),
  ]);
  return {
    connections: connRow.c,
    collections: colRow.c,
    flows: flowRow.c,
  };
}

async function loadQuotaFromDb(userId: number): Promise<QuotaState> {
  const [counts, [quota]] = await Promise.all([
    countFromDb(userId),
    db.select().from(quotaTable).where(eq(quotaTable.id, userId)).limit(1),
  ]);

  const periodEnd = periodEndToTimestamp(quota?.currentPeriodEnd ?? null);
  const now = Math.floor(Date.now() / 1000);
  const items = periodEnd !== 0 && now >= periodEnd ? 0 : (quota?.items ?? 0);

  return {
    connections: counts.connections,
    maxConnections: quota?.maxConnections ?? FREE_QUOTA.maxConnections,
    collections: counts.collections,
    maxCollections: quota?.maxCollections ?? FREE_QUOTA.maxCollections,
    flows: counts.flows,
    maxFlows: quota?.maxFlows ?? FREE_QUOTA.maxFlows,
    items,
    maxItems: quota?.maxItems ?? FREE_QUOTA.maxItems,
    periodEnd,
  };
}

export async function getQuota(userId: number): Promise<QuotaState> {
  const cached = getCachedQuota(userId);
  if (cached) return cached;

  const state = await loadQuotaFromDb(userId);
  setCachedQuota(userId, state);
  return state;
}
