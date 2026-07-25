import type { StreamCommandSender } from "@contfu/connect";

const REFRESH_ALL_THRESHOLD = 10;

type PendingRepair = { itemIds: Set<number>; refreshAll: boolean };

/** Coalesces asynchronous media repair requests until the sync stream is connected. */
export function createMediaRepairCoordinator() {
  const pending = new Map<string, PendingRepair>();
  const inFlight = new Map<string, PendingRepair>();
  let sender: StreamCommandSender | undefined;

  const enqueue = (collection: string, itemIds: number[], source: true): void => {
    const key = `${collection}:${source}`;
    const entry = pending.get(key) ?? { itemIds: new Set<number>(), refreshAll: false };
    for (const itemId of itemIds) entry.itemIds.add(itemId);
    entry.refreshAll ||= itemIds.length === 0 || entry.itemIds.size >= REFRESH_ALL_THRESHOLD;
    pending.set(key, entry);
    flush();
  };

  const requeue = (key: string, entry: PendingRepair): void => {
    const existing = pending.get(key) ?? { itemIds: new Set<number>(), refreshAll: false };
    for (const itemId of entry.itemIds) existing.itemIds.add(itemId);
    existing.refreshAll ||= entry.refreshAll;
    pending.set(key, existing);
  };

  const flush = (): void => {
    if (!sender) return;
    for (const [key, entry] of pending) {
      if (inFlight.has(key)) continue;
      pending.delete(key);
      const [collection] = key.split(":", 1);
      inFlight.set(key, entry);
      const send = entry.refreshAll
        ? sender.refreshAll(collection, true)
        : sender.refresh(
            collection,
            [...entry.itemIds].sort((a, b) => a - b),
            true,
          );
      void send.then(
        () => {
          if (inFlight.get(key) !== entry) return;
          inFlight.delete(key);
          flush();
        },
        () => {
          if (inFlight.get(key) !== entry) return;
          inFlight.delete(key);
          requeue(key, entry);
        },
      );
    }
  };

  return {
    repair: enqueue,
    connected(nextSender: StreamCommandSender): void {
      sender = nextSender;
      flush();
    },
    disconnected(): void {
      sender = undefined;
      for (const [key, entry] of inFlight) {
        inFlight.delete(key);
        requeue(key, entry);
      }
    },
  };
}
