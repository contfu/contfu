import {
  ChangedEvent,
  ChecksumEvent,
  ConnectedEvent,
  DeletedEvent,
  ErrorEvent,
  EventType,
  Item,
  ItemEvent,
  ListIdsEvent,
} from "@contfu/core";

const { EventSource } = typeof window === "undefined" ? await import("eventsource") : window;

type Opts = {
  url?: string;
  handle?: (e: ItemEvent) => Promise<void>;
  reconnect?: boolean;
  maxReconnectDelay?: number;
  initialReconnectDelay?: number;
};

export function connectToSSE(
  key: Buffer,
  opts: Opts & { handle: (e: ItemEvent) => Promise<void> },
): Promise<void>;
export function connectToSSE(
  key: Buffer,
  opts?: Omit<Opts, "handle">,
): Promise<AsyncGenerator<ItemEvent>>;
export async function connectToSSE(
  key: Buffer,
  {
    url = "http://localhost:5173/api/sse",
    handle,
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
  }: Opts = {},
) {
  // Encode key as base64 for URL parameter
  const keyBase64 = key.toString("base64");
  const sseUrl = `${url}?key=${encodeURIComponent(keyBase64)}`;

  // Create event queue (persists across reconnections)
  const eventQueue: ItemEvent[] = [];
  let queueResolve: ((value: ItemEvent) => void) | null = null;

  let eventSource: EventSource | null = null;
  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = reconnect;
  let isReconnecting = false;

  const getNextEvent = (): Promise<ItemEvent> => {
    if (eventQueue.length > 0) {
      return Promise.resolve(eventQueue.shift()!);
    }
    return new Promise<ItemEvent>((res) => {
      queueResolve = res;
    });
  };

  const connect = async (): Promise<void> => {
    if (eventSource) {
      eventSource.close();
    }

    eventSource = new EventSource(sseUrl);

    // Setup event listeners for all event types
    const onEvent = (event: MessageEvent) => {
      const deserialized = deserializeEvent(event.type, event.data);
      if (deserialized.type === EventType.ERROR) {
        eventSource?.close();
        return;
      }
      if (deserialized.type === EventType.CONNECTED) {
        console.log("CONNECTED");
        return;
      }
      if (queueResolve) {
        queueResolve(deserialized);
        queueResolve = null;
      } else {
        eventQueue.push(deserialized);
      }
    };

    const onConnectionError = async () => {
      if (!eventSource || isReconnecting) return;
      isReconnecting = true;
      eventSource.close();

      if (shouldReconnect) {
        // Wait with exponential backoff
        await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
        // Exponential backoff with max cap
        reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
        // Attempt to reconnect
        try {
          isReconnecting = false;
          await connect();
        } catch {
          isReconnecting = false;
          // If reconnection fails, the onConnectionError will be called again
        }
      }
    };

    // Wait for initial connection
    return new Promise<void>((res, rej) => {
      const onConnected = (_event: MessageEvent) => {
        if (!eventSource) return;
        eventSource.removeEventListener("connected", onConnected);
        eventSource.removeEventListener("error", onError);
        // Reset backoff on successful connection
        reconnectDelay = initialReconnectDelay;

        // Setup persistent event listeners after connection
        eventSource.addEventListener("connected", onEvent);
        eventSource.addEventListener("changed", onEvent);
        eventSource.addEventListener("deleted", onEvent);
        eventSource.addEventListener("list_ids", onEvent);
        eventSource.addEventListener("checksum", onEvent);
        eventSource.addEventListener("error", onEvent);
        eventSource.addEventListener("error", onConnectionError);

        // Queue the CONNECTED event so it can be received by the handler/generator
        onEvent(_event);

        res();
      };

      const onError = async (event: Event | MessageEvent) => {
        if (!eventSource) return;
        eventSource.removeEventListener("connected", onConnected);
        eventSource.removeEventListener("error", onError);
        eventSource.close();

        // Check if this is an SSE error event (has data) vs a native connection error
        // In Node.js with eventsource package, event.data exists on SSE events
        const eventData = (event as MessageEvent).data;
        if (eventData) {
          // This is an SSE error event from the server (e.g., E_AUTH, E_CONFLICT)
          try {
            const parsed = JSON.parse(eventData);
            rej(new Error(`SSE error: ${parsed.code || "Unknown error"}`));
          } catch {
            rej(new Error("SSE error: Failed to parse error response"));
          }
          return;
        }

        // Native connection error - If reconnection is enabled, retry instead of rejecting
        if (shouldReconnect && !isReconnecting) {
          isReconnecting = true;
          // Wait with exponential backoff
          await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
          // Exponential backoff with max cap
          reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
          // Attempt to reconnect
          try {
            isReconnecting = false;
            await connect();
            res(); // Resolve the original promise after successful reconnection
          } catch (err) {
            isReconnecting = false;
            rej(err);
          }
        } else {
          rej(new Error("Failed to connect to SSE"));
        }
      };

      if (eventSource) {
        eventSource.addEventListener("connected", onConnected);
        eventSource.addEventListener("error", onError, { once: true });
      }
    });
  };

  // Initial connection
  await connect();

  if (handle) {
    return (async () => {
      do {
        const event = await getNextEvent();
        await handle(event);
      } while (
        shouldReconnect ||
        (eventSource && (eventSource as EventSource).readyState === EventSource.OPEN)
      );
    })();
  }

  return (async function* () {
    do {
      yield await getNextEvent();
    } while (
      shouldReconnect ||
      (eventSource && (eventSource as EventSource).readyState === EventSource.OPEN)
    );
  })();
}

function deserializeEvent(
  eventType: string,
  data: string,
): ItemEvent | ErrorEvent | ConnectedEvent {
  const parsed = JSON.parse(data);

  switch (parsed.type) {
    case EventType.CONNECTED: {
      return { type: EventType.CONNECTED } satisfies ConnectedEvent;
    }
    case EventType.CHANGED: {
      const { item: itemData } = parsed;
      const item = {
        id: Buffer.from(itemData.id, "base64"),
        ref: Buffer.from(itemData.ref, "base64"),
        collection: itemData.collection,
        publishedAt: itemData.publishedAt,
        createdAt: itemData.createdAt,
        changedAt: itemData.changedAt,
        props: deserializeProps(itemData.props),
      } as Item;
      if (itemData.content) item.content = itemData.content;
      return { type: EventType.CHANGED, item } as ChangedEvent;
    }
    case EventType.DELETED: {
      return {
        type: EventType.DELETED,
        item: Buffer.from(parsed.item, "base64"),
      } satisfies DeletedEvent;
    }
    case EventType.LIST_IDS: {
      return {
        type: EventType.LIST_IDS,
        collection: parsed.collection,
        ids: parsed.ids.map((id: string) => Buffer.from(id, "base64")),
      } satisfies ListIdsEvent;
    }
    case EventType.CHECKSUM: {
      return {
        type: EventType.CHECKSUM,
        collection: parsed.collection,
        checksum: Buffer.from(parsed.checksum, "base64"),
      } satisfies ChecksumEvent;
    }
    case EventType.ERROR: {
      return { type: EventType.ERROR, code: parsed.code } satisfies ErrorEvent;
    }
    default:
      throw new Error(`Unknown event type: ${parsed.type}`);
  }
}

/**
 * Deserializes props. For now, props are passed through as-is.
 *
 * TODO: Handle Buffer[] arrays in props. The PageProps type allows Buffer[] values,
 * but we need a convention for how the server serializes them (e.g., with a type marker)
 * to distinguish them from regular string arrays.
 */
function deserializeProps(props: Record<string, unknown>): Record<string, unknown> {
  // For now, just return props as-is. Buffer[] handling needs server-side coordination.
  return props;
}
