import type { KV } from "@nats-io/kv";
import { describe, expect, it } from "bun:test";
import { acquireRateSlot } from "./rate-limiter";

type Entry = {
  value: Uint8Array;
  revision: number;
};

class MockRateLimitKv {
  private entries = new Map<string, Entry>();
  failNextUpdateWithCasConflict = false;

  create(key: string, value: Uint8Array | string): Promise<number> {
    if (this.entries.has(key)) {
      return Promise.reject(new Error("wrong last sequence"));
    }

    const buf = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const entry = { value: buf, revision: 1 };
    this.entries.set(key, entry);
    return Promise.resolve(entry.revision);
  }

  get(key: string): ReturnType<KV["get"]> {
    const entry = this.entries.get(key);
    if (!entry) return Promise.resolve(null);
    return Promise.resolve({
      value: entry.value,
      revision: entry.revision,
      bucket: "",
      key,
      created: new Date(),
      operation: "PUT" as const,
      length: entry.value.length,
      rawKey: key,
      json: <T>() => JSON.parse(Buffer.from(entry.value).toString()) as T,
      string: () => Buffer.from(entry.value).toString(),
    });
  }

  update(key: string, value: Uint8Array | string, revision: number): Promise<number> {
    const entry = this.entries.get(key);
    if (!entry || entry.revision !== revision || this.failNextUpdateWithCasConflict) {
      this.failNextUpdateWithCasConflict = false;
      return Promise.reject(new Error("wrong last sequence"));
    }

    const buf = typeof value === "string" ? new TextEncoder().encode(value) : value;
    const next = { value: buf, revision: entry.revision + 1 };
    this.entries.set(key, next);
    return Promise.resolve(next.revision);
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
