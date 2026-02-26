import type { LiveDataChangedBatchEvent, LiveDataChangedKind, LiveEvent } from "$lib/live/types";
import type { SyncStatus } from "$lib/server/sync-status";

const DATA_CHANGED_WINDOW_MS = 3000 as const;

type Subscriber = (event: LiveEvent) => void;

const subscribers = new Set<Subscriber>();

let bufferedCount = 0;
let bufferedKinds = new Set<LiveDataChangedKind>();
let bufferTimer: ReturnType<typeof setTimeout> | null = null;

export function subscribeLiveUpdates(subscriber: Subscriber): () => void {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

export function publishSyncStatus(status: SyncStatus): void {
  publish({
    type: "sync-status",
    state: status.state,
    reason: status.reason,
    ts: Date.now(),
  });
}

export function bufferDataChanged(kind: LiveDataChangedKind): void {
  bufferedCount += 1;
  bufferedKinds.add(kind);

  if (bufferTimer !== null) {
    return;
  }

  bufferTimer = setTimeout(() => {
    flushDataChangedBatch();
  }, DATA_CHANGED_WINDOW_MS);
}

export function flushDataChangedBatch(): void {
  if (bufferedCount === 0) {
    clearBufferTimer();
    return;
  }

  const event: LiveDataChangedBatchEvent = {
    type: "data-changed-batch",
    count: bufferedCount,
    kinds: [...bufferedKinds],
    windowMs: DATA_CHANGED_WINDOW_MS,
    ts: Date.now(),
  };

  bufferedCount = 0;
  bufferedKinds = new Set<LiveDataChangedKind>();
  clearBufferTimer();
  publish(event);
}

function clearBufferTimer(): void {
  if (bufferTimer !== null) {
    clearTimeout(bufferTimer);
    bufferTimer = null;
  }
}

function publish(event: LiveEvent): void {
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch {
      // Isolate subscriber failures so one client cannot block others.
    }
  }
}

