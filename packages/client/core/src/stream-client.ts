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
} from "@contfu/core";
import { unpack } from "msgpackr";

/**
 * Wire format for events (same as WebSocket/Server).
 * Uses tuples for minimal MessagePack encoding size.
 *
 * Format: [type, ...payload] where type matches EventType enum:
 * - CONNECTED: [0]
 * - ERROR: [1, errorCode]
 * - CHANGED: [2, [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]]
 * - DELETED: [3, deletedItemId]
 * - LIST_IDS: [4, collection, ids[]]
 * - CHECKSUM: [5, collection, checksum]
 * - PING: [6] (keep-alive, ignored by client)
 */
type WireEvent =
  | [EventType.CONNECTED]
  | [EventType.ERROR, string]
  | [EventType.CHANGED, WireItem]
  | [EventType.DELETED, Uint8Array]
  | [EventType.LIST_IDS, number, Uint8Array[]]
  | [EventType.CHECKSUM, number, Uint8Array]
  | [6]; // PING

type WireItem = [
  Uint8Array, // ref
  Uint8Array, // id
  number, // collection
  number, // publishedAt
  number, // createdAt
  number, // changedAt
  Record<string, unknown>, // props
  unknown[]?, // content (optional)
];

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
  // Encode key as base64url for URL parameter
  const keyBase64Url = key.toString("base64url");
  const streamUrl = `${url}?key=${encodeURIComponent(keyBase64Url)}`;

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
    // Abort any existing connection
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

    // Buffer for incomplete messages
    let buffer = new Uint8Array(0);

    // Read and process chunks
    const processChunks = async () => {
      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          // Stream ended - attempt reconnect if enabled
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
          // Read length prefix (4 bytes, big-endian)
          const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
          const messageLength = view.getUint32(0, false);

          // Check if we have the complete message
          if (buffer.length < 4 + messageLength) {
            break; // Wait for more data
          }

          // Extract message data
          const messageData = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);

          // Decode and process the message
          try {
            const wireEvent = unpack(messageData) as WireEvent;
            const event = fromWireEvent(wireEvent);

            if (event) {
              if (event.type === EventType.CONNECTED) {
                // Reset backoff on successful connection
                reconnectDelay = initialReconnectDelay;
                console.log("CONNECTED");
              } else if (event.type === EventType.ERROR) {
                // Error from server - stop reconnecting
                shouldReconnect = false;
                throw new Error(`Stream error: ${event.code}`);
              } else {
                pushEvent(event);
              }
            }
            // PING events (type 6) are ignored
          } catch (err) {
            console.error("Failed to decode stream message:", err);
          }
        }
      }
    };

    // Start processing in the background
    processChunks().catch((err) => {
      if (err.name !== "AbortError") {
        console.error("Stream processing error:", err);
      }
    });
  };

  // Initial connection
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

    case 6: // PING - ignore
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
