import { browser } from "$app/environment";
import type {
  LiveDataChangedBatchEvent,
  LiveReadyEvent,
  LiveSyncStatusEvent,
} from "$lib/live/types";

type LiveEventMap = {
  ready: LiveReadyEvent;
  "sync-status": LiveSyncStatusEvent;
  "data-changed-batch": LiveDataChangedBatchEvent;
  ping: { type: "ping"; ts: number };
};

type LiveEventName = keyof LiveEventMap;
type Unsubscribe = () => void;

let source: EventSource | null = null;
let subscriberCount = 0;

function ensureSource(): EventSource | null {
  if (!browser) return null;
  if (source) return source;
  source = new EventSource("/api/live");
  return source;
}

function releaseSource(): void {
  if (!source || subscriberCount > 0) return;
  source.close();
  source = null;
}

export function subscribeLiveEvent<K extends LiveEventName>(
  eventName: K,
  handler: (event: LiveEventMap[K]) => void,
): Unsubscribe {
  const eventSource = ensureSource();
  if (!eventSource) {
    return () => {};
  }

  const listener: EventListener = (rawEvent) => {
    const message = rawEvent as MessageEvent<string>;
    if (typeof message.data !== "string") return;
    try {
      handler(JSON.parse(message.data) as LiveEventMap[K]);
    } catch {
      // Ignore malformed payloads and keep the shared connection alive.
    }
  };

  subscriberCount += 1;
  eventSource.addEventListener(eventName, listener);

  return () => {
    eventSource.removeEventListener(eventName, listener);
    subscriberCount = Math.max(0, subscriberCount - 1);
    releaseSource();
  };
}

