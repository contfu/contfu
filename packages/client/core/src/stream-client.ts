import {
  Block,
  ChangedEvent,
  ChecksumEvent,
  ConnectedEvent,
  DeletedEvent,
  ErrorEvent,
  EventType,
  Item,
  ItemEvent,
  ListIdsEvent,
  WireEvent,
  WireItem,
  WIRE_PING,
} from "@contfu/core";
import { unpack } from "msgpackr";

type Opts = {
  url?: string;
  handle?: (e: ItemEvent) => Promise<void>;
  reconnect?: boolean;
  maxReconnectDelay?: number;
  initialReconnectDelay?: number;
};

/**
 * Connect to the binary stream endpoint using fetch + ReadableStream.
 * Uses HTTP streaming with msgpack for efficient binary encoding.
 *
 * Returns an async generator that yields ItemEvent objects.
 * Alternatively, pass a `handle` callback for push-based processing.
 */
export function connectToStream(
  key: Buffer,
  opts: Opts & { handle: (e: ItemEvent) => Promise<void> },
): Promise<void>;
export function connectToStream(
  key: Buffer,
  opts?: Omit<Opts, "handle">,
): Promise<AsyncGenerator<ItemEvent>>;
export async function connectToStream(
  key: Buffer,
  {
    url = "http://localhost:5173/api/stream",
    handle,
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
  }: Opts = {},
) {
  // base64url is already URL-safe, no encoding needed
  const keyBase64Url = key.toString("base64url");
  const streamUrl = `${url}?key=${keyBase64Url}`;

  // Create event queue (persists across reconnections)
  const eventQueue: ItemEvent[] = [];
  let queueResolve: ((value: ItemEvent) => void) | null = null;

  let abortController: AbortController | null = null;
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

  const pushEvent = (event: ItemEvent) => {
    if (queueResolve) {
      queueResolve(event);
      queueResolve = null;
    } else {
      eventQueue.push(event);
    }
  };

  const connect = async (): Promise<void> => {
    if (abortController) {
      abortController.abort();
    }
    abortController = new AbortController();

    const response = await fetch(streamUrl, {
      signal: abortController.signal,
      headers: {
        Accept: "application/octet-stream",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Stream connection failed: ${response.status} ${text}`);
    }

    if (!response.body) {
      throw new Error("Streaming not supported in this environment");
    }

    const reader = response.body.getReader();
    let buffer = new Uint8Array(0);

    const processChunks = async () => {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          if (shouldReconnect && !isReconnecting) {
            isReconnecting = true;
            await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
            reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
            try {
              isReconnecting = false;
              await connect();
            } catch {
              isReconnecting = false;
            }
          }
          return;
        }

        // Append new data to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        // Process complete messages from buffer
        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
          const messageLength = view.getUint32(0, false);

          if (buffer.length < 4 + messageLength) {
            break;
          }

          const messageData = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);

          try {
            const wireEvent = unpack(messageData) as WireEvent;
            const event = fromWireEvent(wireEvent);

            if (event) {
              if (event.type === EventType.CONNECTED) {
                reconnectDelay = initialReconnectDelay;
                console.log("CONNECTED");
              } else if (event.type === EventType.ERROR) {
                shouldReconnect = false;
                throw new Error(`Stream error: ${event.code}`);
              } else {
                pushEvent(event);
              }
            }
          } catch (err) {
            console.error("Failed to decode stream message:", err);
          }
        }
      }
    };

    processChunks().catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Stream processing error:", err);
      }
    });
  };

  await connect();

  if (handle) {
    return (async () => {
      while (shouldReconnect || abortController) {
        const event = await getNextEvent();
        await handle(event);
      }
    })();
  }

  return (async function* () {
    while (shouldReconnect || abortController) {
      yield await getNextEvent();
    }
  })();
}

/**
 * Convert wire format back to typed events.
 */
function fromWireEvent(wireEvent: WireEvent): ItemEvent | ErrorEvent | ConnectedEvent | null {
  const type = wireEvent[0];

  switch (type) {
    case EventType.CONNECTED:
      return { type: EventType.CONNECTED } satisfies ConnectedEvent;

    case EventType.ERROR:
      return {
        type: EventType.ERROR,
        code: wireEvent[1] as string,
      } satisfies ErrorEvent;

    case EventType.CHANGED: {
      const wireItem = wireEvent[1] as WireItem;
      const [ref, id, collection, publishedAt, createdAt, changedAt, props, content] = wireItem;

      const item: Item = {
        ref: Buffer.from(ref),
        id: Buffer.from(id),
        collection,
        publishedAt: publishedAt || undefined,
        createdAt,
        changedAt,
        props: deserializeProps(props),
      };
      if (content) {
        item.content = content as Block[];
      }
      return { type: EventType.CHANGED, item } satisfies ChangedEvent;
    }

    case EventType.DELETED:
      return {
        type: EventType.DELETED,
        item: Buffer.from(wireEvent[1] as Uint8Array),
      } satisfies DeletedEvent;

    case EventType.LIST_IDS: {
      const [, collection, ids] = wireEvent as [number, number, Uint8Array[]];
      return {
        type: EventType.LIST_IDS,
        collection,
        ids: ids.map((id) => Buffer.from(id)),
      } satisfies ListIdsEvent;
    }

    case EventType.CHECKSUM: {
      const [, collection, checksum] = wireEvent as [number, number, Uint8Array];
      return {
        type: EventType.CHECKSUM,
        collection,
        checksum: Buffer.from(checksum),
      } satisfies ChecksumEvent;
    }

    case WIRE_PING:
      return null;

    default:
      console.warn(`Unknown wire event type: ${type}`);
      return null;
  }
}

/**
 * Deserialize props, converting Uint8Array arrays back to Buffer.
 */
function deserializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof Uint8Array) {
      result[key] = (value as Uint8Array[]).map((arr) => Buffer.from(arr));
    } else {
      result[key] = value;
    }
  }
  return result;
}
