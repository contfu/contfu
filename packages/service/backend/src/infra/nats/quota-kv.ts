import type { KV } from "@nats-io/kv";
import { pack, unpack } from "msgpackr";
import { eq, count } from "drizzle-orm";
import type { QuotaState } from "@contfu/svc-core";
import type { ProductQuota } from "../polar/products";
import { FREE_QUOTA } from "../polar/products";
import { getKvManager } from "./kvm";
import { db } from "../db/db";
import { connectionTable, collectionTable, flowTable, quotaTable } from "../db/schema";
import { createLogger } from "../logger/index";

const log = createLogger("quota-kv");

const QUOTA_BUCKET = "quota";

type CountField = "connections" | "collections" | "flows";

type KvEntry = {
  value: Uint8Array;
  revision: number;
};

let quotaKv: Promise<KV> | null = null;

async function getQuotaKv(): Promise<KV> {
  return (quotaKv ??= getKvManager().then((kvm) => kvm.create(QUOTA_BUCKET)));
}

function encodeState(state: QuotaState): Uint8Array {
  return pack(state);
}

function decodeState(value: Uint8Array): QuotaState | null {
  try {
    return unpack(value) as QuotaState;
  } catch {
    return null;
  }
}

function isCasConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("wrong last sequence") || message.includes("sequence");
}

function buildKey(userId: number): string {
  return String(userId);
}

function periodEndToTimestamp(periodEnd: Date | null): number {
  return periodEnd ? Math.floor(periodEnd.getTime() / 1000) : 0;
}

async function getQuotaFromKv(userId: number): Promise<QuotaState | null> {
  const store = await getQuotaKv();
  const entry = (await store.get(buildKey(userId))) as KvEntry | null;
  if (!entry) return null;
  return decodeState(entry.value);
}

async function getQuotaFromDb(userId: number): Promise<QuotaState> {
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
  return (await getQuotaFromKv(userId)) ?? (await getQuotaFromDb(userId));
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

export async function ensureQuota(
  userId: number,
  limits: ProductQuota,
  periodEnd: Date | null,
): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);
  const existing = (await store.get(key)) as KvEntry | null;
  if (existing) return;

  const counts = await countFromDb(userId);
  const state: QuotaState = {
    connections: counts.connections,
    maxConnections: limits.maxConnections,
    collections: counts.collections,
    maxCollections: limits.maxCollections,
    flows: counts.flows,
    maxFlows: limits.maxFlows,
    items: 0,
    maxItems: limits.maxItems,
    periodEnd: periodEndToTimestamp(periodEnd),
  };

  try {
    await store.create(key, encodeState(state));
  } catch (error) {
    if (!isCasConflict(error)) throw error;
    // Already created concurrently — fine
  }
}

export async function setLimits(
  userId: number,
  limits: ProductQuota,
  periodEnd: Date | null,
): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);

  while (true) {
    const entry = (await store.get(key)) as KvEntry | null;
    if (!entry) {
      await ensureQuota(userId, limits, periodEnd);
      return;
    }

    const state = decodeState(entry.value);
    if (!state) return;

    const updated: QuotaState = {
      ...state,
      maxConnections: limits.maxConnections,
      maxCollections: limits.maxCollections,
      maxFlows: limits.maxFlows,
      maxItems: limits.maxItems,
      periodEnd: periodEndToTimestamp(periodEnd),
    };

    try {
      await store.update(key, encodeState(updated), entry.revision);
      return;
    } catch (error) {
      if (isCasConflict(error)) continue;
      throw error;
    }
  }
}

export async function incrementCount(userId: number, field: CountField): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);

  while (true) {
    const entry = (await store.get(key)) as KvEntry | null;
    if (!entry) {
      log.warn({ userId, field }, "Quota entry missing for increment");
      return;
    }

    const state = decodeState(entry.value);
    if (!state) return;

    const updated: QuotaState = { ...state, [field]: state[field] + 1 };

    try {
      await store.update(key, encodeState(updated), entry.revision);
      return;
    } catch (error) {
      if (isCasConflict(error)) continue;
      throw error;
    }
  }
}

export async function decrementCount(userId: number, field: CountField): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);

  while (true) {
    const entry = (await store.get(key)) as KvEntry | null;
    if (!entry) {
      log.warn({ userId, field }, "Quota entry missing for decrement");
      return;
    }

    const state = decodeState(entry.value);
    if (!state) return;

    const updated: QuotaState = { ...state, [field]: Math.max(0, state[field] - 1) };

    try {
      await store.update(key, encodeState(updated), entry.revision);
      return;
    } catch (error) {
      if (isCasConflict(error)) continue;
      throw error;
    }
  }
}

export async function addItems(userId: number, itemCount: number): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);

  while (true) {
    const entry = (await store.get(key)) as KvEntry | null;
    if (!entry) {
      log.warn({ userId }, "Quota entry missing for addItems");
      return;
    }

    const state = decodeState(entry.value);
    if (!state) return;

    const updated: QuotaState = { ...state, items: state.items + itemCount };

    try {
      await store.update(key, encodeState(updated), entry.revision);
      return;
    } catch (error) {
      if (isCasConflict(error)) continue;
      throw error;
    }
  }
}

export async function resetItemsIfPeriodExpired(userId: number): Promise<void> {
  const store = await getQuotaKv();
  const key = buildKey(userId);

  while (true) {
    const entry = (await store.get(key)) as KvEntry | null;
    if (!entry) return;

    const state = decodeState(entry.value);
    if (!state) return;

    if (state.periodEnd === 0 || Math.floor(Date.now() / 1000) < state.periodEnd) return;

    const updated: QuotaState = { ...state, items: 0 };

    try {
      await store.update(key, encodeState(updated), entry.revision);
      return;
    } catch (error) {
      if (isCasConflict(error)) continue;
      throw error;
    }
  }
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

export async function isItemQuotaExceeded(userId: number): Promise<boolean> {
  const result = await checkQuota(userId, "items");
  return !result.allowed;
}

/** Returns periodEnd timestamp (unix seconds) or 0 if not set. */
export async function getQuotaPeriodEnd(userId: number): Promise<number> {
  const state = await getQuota(userId);
  return state.periodEnd;
}

export type { QuotaState };
