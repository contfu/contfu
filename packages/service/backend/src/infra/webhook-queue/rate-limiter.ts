import type { KV } from "@nats-io/kv";
import { getKvManager } from "../nats/kvm";
import type { RateLimitConfig } from "./types";

const RATE_LIMIT_BUCKET = "wh-ratelimit";
const RATE_LIMIT_TTL_MS = 2000;

type CounterState = {
  count: number;
  windowStart: number;
};

type KvEntry = {
  value: Uint8Array;
  revision: number;
};

let rateLimitKv: Promise<KV> | null = null;

async function getRateLimitKv(): Promise<KV> {
  return (rateLimitKv ??= getKvManager().then((kvm) =>
    kvm.create(RATE_LIMIT_BUCKET, {
      ttl: RATE_LIMIT_TTL_MS,
      markerTTL: RATE_LIMIT_TTL_MS,
    }),
  ));
}

function encodeState(state: CounterState): Uint8Array {
  return Buffer.from(JSON.stringify(state), "utf8");
}

function decodeState(value: Uint8Array): CounterState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value).toString("utf8")) as CounterState;
    if (typeof parsed.count !== "number" || typeof parsed.windowStart !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function isCasConflict(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes("wrong last sequence") || message.includes("sequence");
}

export function buildRateLimitKey(
  userId: number,
  sourceId: number,
  integrationId?: number | null,
): string {
  return integrationId ? `${userId}.i${integrationId}` : `${userId}.${sourceId}`;
}

export async function acquireRateSlot(
  userId: number,
  sourceId: number,
  config: RateLimitConfig,
  kv: Pick<KV, "create" | "get" | "update"> | null = null,
  integrationId?: number | null,
): Promise<number> {
  const store = kv ?? (await getRateLimitKv());
  const key = buildRateLimitKey(userId, sourceId, integrationId);

  while (true) {
    const now = Date.now();
    const entry = (await store.get(key)) as KvEntry | null;

    if (!entry) {
      try {
        await store.create(key, encodeState({ count: 1, windowStart: now }));
        return 0;
      } catch (error) {
        if (isCasConflict(error)) continue;
        throw error;
      }
    }

    const state = decodeState(entry.value);
    const fallbackState: CounterState = { count: 0, windowStart: now };
    const current = state ?? fallbackState;
    const elapsed = now - current.windowStart;

    if (elapsed >= config.windowMs) {
      try {
        await store.update(key, encodeState({ count: 1, windowStart: now }), entry.revision);
        return 0;
      } catch (error) {
        if (isCasConflict(error)) continue;
        throw error;
      }
    }

    if (current.count < config.maxRequests) {
      try {
        await store.update(
          key,
          encodeState({ count: current.count + 1, windowStart: current.windowStart }),
          entry.revision,
        );
        return 0;
      } catch (error) {
        if (isCasConflict(error)) continue;
        throw error;
      }
    }

    return Math.max(0, current.windowStart + config.windowMs - now);
  }
}
