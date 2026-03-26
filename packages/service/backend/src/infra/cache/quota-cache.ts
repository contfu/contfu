import { lru } from "tiny-lru";
import { pack, unpack } from "msgpackr";
import type { QuotaState } from "@contfu/svc-core";
import { getNatsConnection } from "../nats/connection";
import { createLogger } from "../logger/index";

const log = createLogger("quota-cache");

const cache = lru<QuotaState>(10_000);

export function getCachedQuota(userId: number): QuotaState | undefined {
  return cache.get(String(userId));
}

export function setCachedQuota(userId: number, state: QuotaState): void {
  cache.set(String(userId), state);
}

// --- NATS pub/sub for cross-node cache sync ---

const COUNTS_SUBJECT = "quota.counts";
const LIMITS_SUBJECT = "quota.limits";

type CountsPatch = Record<string, number>;
type LimitsPatch = Record<string, number>;
type Payload = [userId: number, patch: Record<string, number>];

export function publishCountDelta(userId: number, patch: Partial<Record<keyof QuotaState, number>>): void {
  void getNatsConnection().then((nc) => nc.publish(COUNTS_SUBJECT, pack([userId, patch])));
}

export function publishLimitChange(userId: number, patch: Partial<Record<keyof QuotaState, number>>): void {
  void getNatsConnection().then((nc) => nc.publish(LIMITS_SUBJECT, pack([userId, patch])));
}

export async function startQuotaSubscriptions(): Promise<void> {
  const nc = await getNatsConnection();

  const countsSub = nc.subscribe(COUNTS_SUBJECT);
  const limitsSub = nc.subscribe(LIMITS_SUBJECT);

  void (async () => {
    for await (const msg of countsSub) {
      try {
        const [userId, patch] = unpack(msg.data) as Payload;
        const entry = cache.get(String(userId));
        if (entry) {
          for (const [field, delta] of Object.entries(patch as CountsPatch)) {
            (entry as Record<string, number>)[field] += delta;
          }
        }
      } catch (err) {
        log.warn({ err }, "Failed to process quota counts message");
      }
    }
  })();

  void (async () => {
    for await (const msg of limitsSub) {
      try {
        const [userId, patch] = unpack(msg.data) as Payload;
        const entry = cache.get(String(userId));
        if (entry) {
          for (const [field, value] of Object.entries(patch as LimitsPatch)) {
            (entry as Record<string, number>)[field] = value;
          }
        }
      } catch (err) {
        log.warn({ err }, "Failed to process quota limits message");
      }
    }
  })();

  log.info("Quota cache subscriptions started");
}

export type { QuotaState };
