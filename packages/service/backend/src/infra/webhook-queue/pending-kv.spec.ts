import type { KV } from "@nats-io/kv";
import { describe, expect, it } from "bun:test";
import { cancelPending, clearPending, isPending, markPending } from "./pending-kv";

class MockPendingKv {
  private entries = new Map<string, Uint8Array>();

  create(key: string, value: Uint8Array | string): Promise<number> {
    if (this.entries.has(key)) {
      return Promise.reject(new Error("wrong last sequence"));
    }
    const buf = typeof value === "string" ? new TextEncoder().encode(value) : value;
    this.entries.set(key, buf);
    return Promise.resolve(1);
  }

  get(key: string): ReturnType<KV["get"]> {
    const value = this.entries.get(key);
    if (!value) return Promise.resolve(null);
    return Promise.resolve({
      value,
      revision: 1,
      bucket: "",
      key,
      created: new Date(),
      operation: "PUT" as const,
      length: value.length,
      rawKey: key,
      json: <T>() => JSON.parse(Buffer.from(value).toString()) as T,
      string: () => Buffer.from(value).toString(),
    });
  }

  delete(key: string): Promise<void> {
    this.entries.delete(key);
    return Promise.resolve();
  }
}

describe("pending-kv", () => {
  it("marks and reads pending keys", async () => {
    const kv = new MockPendingKv();

    const created = await markPending(1, 2, "page-1", kv);
    const pending = await isPending(1, 2, "page-1", kv);

    expect(created).toBe(true);
    expect(pending).toBe(true);
  });

  it("deduplicates duplicate pending marks", async () => {
    const kv = new MockPendingKv();

    expect(await markPending(1, 2, "page-1", kv)).toBe(true);
    expect(await markPending(1, 2, "page-1", kv)).toBe(false);
  });

  it("cancels pending keys", async () => {
    const kv = new MockPendingKv();

    await markPending(1, 2, "page-1", kv);
    await cancelPending(1, 2, "page-1", kv);

    expect(await isPending(1, 2, "page-1", kv)).toBe(false);
  });

  it("clears pending keys", async () => {
    const kv = new MockPendingKv();

    await markPending(1, 2, "page-1", kv);
    await clearPending(1, 2, "page-1", kv);

    expect(await isPending(1, 2, "page-1", kv)).toBe(false);
  });
});
