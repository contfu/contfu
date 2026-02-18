import { describe, expect, it } from "bun:test";
import { cancelPending, clearPending, isPending, markPending } from "./pending-kv";

class MockPendingKv {
  private entries = new Map<string, Uint8Array>();

  async create(key: string, value: Uint8Array): Promise<number> {
    if (this.entries.has(key)) {
      throw new Error("wrong last sequence");
    }
    this.entries.set(key, value);
    return 1;
  }

  async get(key: string): Promise<{ value: Uint8Array } | null> {
    const value = this.entries.get(key);
    if (!value) return null;
    return { value };
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
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
