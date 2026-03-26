import { describe, expect, it, mock } from "bun:test";
import type { QuotaState } from "@contfu/svc-core";

// ---------------------------------------------------------------------------
// Fake NATS that actually routes messages between publish and subscribe
// ---------------------------------------------------------------------------

type Subscriber = { subject: string; push: (msg: { data: Uint8Array }) => void };
const subscribers: Subscriber[] = [];

function createFakeNc() {
  return {
    publish(subject: string, data: Uint8Array) {
      for (const sub of subscribers) {
        if (sub.subject === subject) {
          queueMicrotask(() => sub.push({ data }));
        }
      }
    },
    subscribe(subject: string) {
      const queue: { data: Uint8Array }[] = [];
      let resolve: ((value: IteratorResult<{ data: Uint8Array }>) => void) | null = null;

      const sub: Subscriber = {
        subject,
        push(msg) {
          if (resolve) {
            const r = resolve;
            resolve = null;
            r({ value: msg, done: false });
          } else {
            queue.push(msg);
          }
        },
      };
      subscribers.push(sub);

      return {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<{ data: Uint8Array }>> {
              const queued = queue.shift();
              if (queued) return Promise.resolve({ value: queued, done: false });
              return new Promise((r) => {
                resolve = r;
              });
            },
          };
        },
      };
    },
  };
}

const fakeNc = createFakeNc();

await mock.module("../nats/connection", () => ({
  getNatsConnection: () => Promise.resolve(fakeNc),
  onNatsReconnect: () => {},
}));

const {
  getCachedQuota,
  setCachedQuota,
  publishCountDelta,
  publishLimitChange,
  startQuotaSubscriptions,
} = await import("./quota-cache");

function tick(): Promise<void> {
  return new Promise((r) => setTimeout(r, 5));
}

function makeQuota(overrides?: Partial<QuotaState>): QuotaState {
  return {
    connections: 1,
    maxConnections: 5,
    collections: 2,
    maxCollections: 10,
    flows: 0,
    maxFlows: 5,
    items: 10,
    maxItems: 100,
    periodEnd: 0,
    ...overrides,
  };
}

await startQuotaSubscriptions();

describe("quota-cache pub/sub sync", () => {
  it("getCachedQuota returns undefined on miss", () => {
    expect(getCachedQuota(9999)).toBeUndefined();
  });

  it("setCachedQuota + getCachedQuota round-trips", () => {
    const quota = makeQuota();
    setCachedQuota(1000, quota);
    expect(getCachedQuota(1000)).toBe(quota);
  });

  it("publishCountDelta patches an existing cache entry", async () => {
    setCachedQuota(100, makeQuota({ connections: 1 }));

    publishCountDelta(100, { connections: 1 });
    await tick();

    expect(getCachedQuota(100)!.connections).toBe(2);
  });

  it("publishCountDelta with negative delta decrements", async () => {
    setCachedQuota(101, makeQuota({ collections: 3 }));

    publishCountDelta(101, { collections: -1 });
    await tick();

    expect(getCachedQuota(101)!.collections).toBe(2);
  });

  it("publishCountDelta ignores users not in cache", async () => {
    publishCountDelta(777, { connections: 5 });
    await tick();

    expect(getCachedQuota(777)).toBeUndefined();
  });

  it("publishLimitChange sets absolute value on existing entry", async () => {
    setCachedQuota(200, makeQuota({ maxConnections: 5 }));

    publishLimitChange(200, { maxConnections: 50 });
    await tick();

    expect(getCachedQuota(200)!.maxConnections).toBe(50);
  });

  it("publishLimitChange ignores users not in cache", async () => {
    publishLimitChange(778, { maxItems: 9999 });
    await tick();

    expect(getCachedQuota(778)).toBeUndefined();
  });

  it("multiple deltas accumulate correctly", async () => {
    setCachedQuota(300, makeQuota({ items: 10 }));

    publishCountDelta(300, { items: 5 });
    publishCountDelta(300, { items: 3 });
    publishCountDelta(300, { items: -2 });
    await tick();

    expect(getCachedQuota(300)!.items).toBe(16); // 10 + 5 + 3 - 2
  });

  it("publishLimitChange patches multiple fields at once", async () => {
    setCachedQuota(400, makeQuota({ maxConnections: 5, maxItems: 100 }));

    publishLimitChange(400, { maxConnections: 50, maxItems: 1000, periodEnd: 12345 });
    await tick();

    const state = getCachedQuota(400)!;
    expect(state.maxConnections).toBe(50);
    expect(state.maxItems).toBe(1000);
    expect(state.periodEnd).toBe(12345);
  });

  it("counts and limits can be mixed for the same user", async () => {
    setCachedQuota(500, makeQuota({ flows: 1, maxFlows: 5 }));

    publishCountDelta(500, { flows: 2 });
    publishLimitChange(500, { maxFlows: 20 });
    await tick();

    const state = getCachedQuota(500)!;
    expect(state.flows).toBe(3);
    expect(state.maxFlows).toBe(20);
  });
});
