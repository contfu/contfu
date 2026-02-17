import {
  Block,
  EventType,
  WIRE_PING,
  WireEvent,
  WireItem,
  type Item as InternalItem,
  type PageProps,
} from "@contfu/core";
import { unpack } from "msgpackr";

/** Item as received by consumers — collection is an encoded string ID */
export type Item<T extends PageProps = Record<never, never>> = Omit<
  InternalItem<T>,
  "collection"
> & {
  collection: string;
};

export type ChangedEvent = { type: typeof EventType.CHANGED; item: Item };
export type DeletedEvent = { type: typeof EventType.DELETED; item: Buffer };
export type ItemEvent = ChangedEvent | DeletedEvent;

/** Emitted when stream connection is established. */
export type StreamConnectedEvent = { type: "stream:connected" };

/** Emitted when stream connection is lost. */
export type StreamDisconnectedEvent = { type: "stream:disconnected"; reason?: string };

/** Connection lifecycle events. */
export type StreamEvent = StreamConnectedEvent | StreamDisconnectedEvent;

/** Item event extended with event index from JetStream replay. */
export type IndexedItemEvent = ItemEvent & { eventIndex: number };

/** Thrown when the event index has expired (410 Gone). Consumer should full resync. */
export class IndexExpiredError extends Error {
  constructor() {
    super("Event index expired, full resync required");
    this.name = "IndexExpiredError";
  }
}

type BaseOpts = {
  /** Stream endpoint URL (default: http://localhost:5173/api/stream) */
  url?: string;
  /** Event index to replay from. Events since this index will be replayed before live events. */
  from?: number;
  /** Enable automatic reconnection on disconnect (default: true) */
  reconnect?: boolean;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialReconnectDelay?: number;
};

type OptsWithConnectionEvents = BaseOpts & { connectionEvents: true };
type OptsWithoutConnectionEvents = BaseOpts & { connectionEvents?: false };

/**
 * Connect to the binary stream endpoint.
 *
 * Returns an async generator that yields events directly as they arrive.
 * Connection and reconnection are handled automatically.
 *
 * @example
 * ```ts
 * // Simple usage - just item events
 * for await (const event of connectToStream(key)) {
 *   console.log(event.type, event);
 * }
 *
 * // With connection lifecycle events
 * for await (const event of connectToStream(key, { connectionEvents: true })) {
 *   if (event.type === "stream:connected") {
 *     console.log("Connected!");
 *   } else if (event.type === "stream:disconnected") {
 *     console.log("Disconnected:", event.reason);
 *   } else {
 *     console.log(event.type, event);
 *   }
 * }
 * ```
 */
export function connectToStream(
  key: Buffer,
  opts: OptsWithConnectionEvents,
): AsyncGenerator<ItemEvent | StreamEvent>;
export function connectToStream(
  key: Buffer,
  opts?: OptsWithoutConnectionEvents,
): AsyncGenerator<ItemEvent>;
export async function* connectToStream(
  key: Buffer,
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): AsyncGenerator<ItemEvent | StreamEvent> {
  const {
    url = "http://localhost:5173/api/stream",
    from,
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
    connectionEvents = false,
  } = opts;

  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  if (from != null) {
    params.set("from", from.toString());
  }
  const streamUrl = `${url}?${params.toString()}`;

  let reconnectDelay = initialReconnectDelay;
  // Always try at least once; reconnect controls retries on failure
  let shouldReconnect = true;

  while (shouldReconnect) {
    try {
      const response = await fetch(streamUrl, {
        headers: { Accept: "application/octet-stream" },
      });

      if (!response.ok) {
        if (response.status === 410) {
          throw new IndexExpiredError();
        }
        const text = await response.text();
        throw new Error(`Stream connection failed: ${response.status} ${text}`);
      }

      if (!response.body) {
        throw new Error("Streaming not supported in this environment");
      }

      // HTTP 200 = connected — reset reconnect delay and emit lifecycle event
      reconnectDelay = initialReconnectDelay;
      if (connectionEvents) {
        yield { type: "stream:connected" };
      }

      const reader = response.body.getReader();
      let buffer = new Uint8Array(0);

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          if (connectionEvents) {
            yield { type: "stream:disconnected", reason: "Stream ended" };
          }
          break;
        }

        // Append to buffer
        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        // Process complete messages
        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
          const messageLength = view.getUint32(0, false);

          if (buffer.length < 4 + messageLength) break;

          const messageData = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);

          const wireEvent = unpack(messageData) as WireEvent;
          const event = fromWireEvent(wireEvent);

          if (event) {
            yield event;
          }
        }
      }
    } catch (err) {
      if (err instanceof IndexExpiredError) {
        throw err;
      }
      if (connectionEvents && !(err instanceof Error && err.message.startsWith("Stream error:"))) {
        yield {
          type: "stream:disconnected",
          reason: err instanceof Error ? err.message : "Unknown error",
        };
      }

      // Don't reconnect if reconnect option is false
      if (!shouldReconnect || !reconnect) {
        throw err;
      }
    }

    // Exit if reconnection is disabled
    if (!reconnect) break;
    if (!shouldReconnect) break;

    await new Promise((r) => setTimeout(r, reconnectDelay));
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }
}

/**
 * Convert wire format back to typed events.
 */
function fromWireEvent(wireEvent: WireEvent): ItemEvent | null {
  const type = wireEvent[0];

  switch (type) {
    case EventType.CHANGED: {
      const wireItem = wireEvent[1] as WireItem;
      const [ref, id, collection, changedAt, props, content] = wireItem;

      const item: Item = {
        ref: Buffer.from(ref),
        id: Buffer.from(id),
        collection,
        changedAt,
        props: deserializeProps(props),
      };
      if (content) {
        item.content = content as Block[];
      }
      const event: ChangedEvent = { type: EventType.CHANGED, item };
      const eventIndex = wireEvent[2] as number | undefined;
      if (eventIndex != null) {
        return { ...event, eventIndex } as IndexedItemEvent;
      }
      return event;
    }

    case EventType.DELETED: {
      const event: DeletedEvent = {
        type: EventType.DELETED,
        item: Buffer.from(wireEvent[1] as Uint8Array),
      };
      const eventIndex = wireEvent[2] as number | undefined;
      if (eventIndex != null) {
        return { ...event, eventIndex } as IndexedItemEvent;
      }
      return event;
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
