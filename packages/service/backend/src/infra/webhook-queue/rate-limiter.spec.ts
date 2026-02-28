import { describe, expect, it } from "bun:test";
import { acquireRateSlot } from "./rate-limiter";

type Entry = {
  value: Uint8Array;
  revision: number;
};

class MockRateLimitKv {
  private entries = new Map<string, Entry>();
  failNextUpdateWithCasConflict = false;

  create(key: string, value: Uint8Array): number {
    if (this.entries.has(key)) {
      throw new Error("wrong last sequence");
    }

    const entry = { value, revision: 1 };
    this.entries.set(key, entry);
    return entry.revision;
  }

  get(key: string): Entry | null {
    return this.entries.get(key) ?? null;
  }

  update(key: string, value: Uint8Array, revision: number): number {
    const entry = this.entries.get(key);
    if (!entry || entry.revision !== revision || this.failNextUpdateWithCasConflict) {
      this.failNextUpdateWithCasConflict = false;
      throw new Error("wrong last sequence");
    }

    const next = { value, revision: entry.revision + 1 };
    this.entries.set(key, next);
    return next.revision;
  }
}

const rateLimitConfig = { windowMs: 1000, maxRequests: 3 };

describe("rate-limiter", () => {
  it("allows the first maxRequests calls in a window", async () => {
    const kv = new MockRateLimitKv();

    expect(await acquireRateSlot(1, 2, rateLimitConfig, kv)).toBe(0);
    expect(await acquireRateSlot(1, 2, rateLimitConfig, kv)).toBe(0);
    expect(await acquireRateSlot(1, 2, rateLimitConfig, kv)).toBe(0);
  });

  it("returns positive delay when the window is exhausted", async () => {
    const kv = new MockRateLimitKv();

    await acquireRateSlot(1, 2, rateLimitConfig, kv);
    await acquireRateSlot(1, 2, rateLimitConfig, kv);
    await acquireRateSlot(1, 2, rateLimitConfig, kv);

    const delay = await acquireRateSlot(1, 2, rateLimitConfig, kv);
    expect(delay).toBeGreaterThan(0);
  });

  it("allows requests again after the time window rolls over", async () => {
    const kv = new MockRateLimitKv();

    await acquireRateSlot(1, 2, rateLimitConfig, kv);
    await acquireRateSlot(1, 2, rateLimitConfig, kv);
    await acquireRateSlot(1, 2, rateLimitConfig, kv);

    await Bun.sleep(1005);
    const delay = await acquireRateSlot(1, 2, rateLimitConfig, kv);

    expect(delay).toBe(0);
  });

  it("retries on CAS conflicts and eventually succeeds", async () => {
    const kv = new MockRateLimitKv();

    await acquireRateSlot(1, 2, rateLimitConfig, kv);
    kv.failNextUpdateWithCasConflict = true;

    const delay = await acquireRateSlot(1, 2, rateLimitConfig, kv);
    expect(delay).toBe(0);
  });
});
