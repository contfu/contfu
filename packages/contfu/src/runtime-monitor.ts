import { EventType } from "@contfu/core";
import type { SyncEvent } from "./contfu";

export type RuntimeIntegrationState = "disabled" | "connecting" | "syncing" | "connected" | "error";

export type RuntimeStatus = {
  state: RuntimeIntegrationState;
  reason: string | null;
};

export type RuntimeDataChangedKind = "item" | "schema" | "unknown";

export type RuntimeNotification =
  | { type: "runtime-status"; state: RuntimeIntegrationState; reason: string | null; ts: number }
  | {
      type: "data-changed-batch";
      count: number;
      kinds: RuntimeDataChangedKind[];
      windowMs: number;
      ts: number;
    };

export type RuntimeEventMonitor = {
  getStatus(): RuntimeStatus;
  subscribe(subscriber: (event: RuntimeNotification) => void): () => void;
  start(): void;
};

const DATA_CHANGED_WINDOW_MS = 250;
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

export function createRuntimeEventMonitor(events: AsyncIterable<SyncEvent>): RuntimeEventMonitor {
  let status: RuntimeStatus = { state: "disabled", reason: null };
  let started = false;
  let bufferedCount = 0;
  let bufferedKinds = new Set<RuntimeDataChangedKind>();
  let bufferTimer: ReturnType<typeof setTimeout> | null = null;
  const subscribers = new Set<(event: RuntimeNotification) => void>();

  function publish(event: RuntimeNotification) {
    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch {
        // Keep one broken subscriber from affecting the rest.
      }
    }
  }

  function setStatus(next: RuntimeStatus) {
    status = next;
    publish({ type: "runtime-status", ...next, ts: Date.now() });
  }

  function clearBufferTimer() {
    if (bufferTimer !== null) {
      clearTimeout(bufferTimer);
      bufferTimer = null;
    }
  }

  function flushDataChangedBatch() {
    if (bufferedCount === 0) {
      clearBufferTimer();
      return;
    }

    publish({
      type: "data-changed-batch",
      count: bufferedCount,
      kinds: [...bufferedKinds],
      windowMs: DATA_CHANGED_WINDOW_MS,
      ts: Date.now(),
    });

    bufferedCount = 0;
    bufferedKinds = new Set<RuntimeDataChangedKind>();
    clearBufferTimer();
  }

  function bufferDataChanged(kind: RuntimeDataChangedKind) {
    bufferedCount += 1;
    bufferedKinds.add(kind);

    if (bufferTimer !== null) {
      return;
    }

    bufferTimer = setTimeout(flushDataChangedBatch, DATA_CHANGED_WINDOW_MS);
  }

  function handleEvent(event: SyncEvent) {
    if (event.type === EventType.STREAM_CONNECTED) {
      setStatus({ state: "connected", reason: null });
    } else if (event.type === EventType.SNAPSHOT_START) {
      setStatus({ state: "syncing", reason: null });
    } else if (event.type === EventType.SNAPSHOT_END) {
      setStatus({ state: "connected", reason: null });
    } else if (event.type === EventType.STREAM_DISCONNECTED) {
      setStatus({ state: "error", reason: event.reason ?? "Disconnected from Contfu" });
    } else if (event.type === EventType.COLLECTION_SCHEMA) {
      bufferDataChanged("schema");
    } else if (event.type === EventType.ITEM_CHANGED || event.type === EventType.ITEM_DELETED) {
      bufferDataChanged("item");
    } else {
      bufferDataChanged("unknown");
    }
  }

  async function consume() {
    let retryDelay = INITIAL_RETRY_MS;

    while (true) {
      setStatus({ state: "connecting", reason: null });

      try {
        for await (const event of events) {
          retryDelay = INITIAL_RETRY_MS;
          handleEvent(event);
        }

        throw new Error("Sync event stream ended unexpectedly");
      } catch (error) {
        setStatus({
          state: "error",
          reason: error instanceof Error ? error.message : "Unknown sync error",
        });
      }

      await sleep(retryDelay);
      retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    }
  }

  return {
    getStatus: () => status,
    subscribe(subscriber) {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    start() {
      if (started) return;
      started = true;
      void consume();
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
