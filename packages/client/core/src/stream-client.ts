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

/** Emitted when stream connection is established. */
export type StreamConnectedEvent = { type: "stream:connected" };

/** Emitted when stream connection is lost. */
export type StreamDisconnectedEvent = { type: "stream:disconnected"; reason?: string };

/** Connection lifecycle events. */
export type StreamEvent = StreamConnectedEvent | StreamDisconnectedEvent;

type BaseOpts = {
  /** Stream endpoint URL (default: http://localhost:5173/api/stream) */
  url?: string;
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
export function connectToStream(key: Buffer, opts?: OptsWithoutConnectionEvents): AsyncGenerator<ItemEvent>;
export async function* connectToStream(
  key: Buffer,
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): AsyncGenerator<ItemEvent | StreamEvent> {
  const {
    url = "http://localhost:5173/api/stream",
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
    connectionEvents = false,
  } = opts;

  const keyBase64Url = key.toString("base64url");
  const streamUrl = `${url}?key=${keyBase64Url}`;

  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = reconnect;

  while (shouldReconnect) {
    try {
      const response = await fetch(streamUrl, {
        headers: { Accept: "application/octet-stream" },
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
            if (event.type === EventType.CONNECTED) {
              reconnectDelay = initialReconnectDelay;
              if (connectionEvents) {
                yield { type: "stream:connected" };
              }
            } else if (event.type === EventType.ERROR) {
              shouldReconnect = false;
              throw new Error(`Stream error: ${event.code}`);
            } else {
              yield event;
            }
          }
        }
      }
    } catch (err) {
      if (connectionEvents && !(err instanceof Error && err.message.startsWith("Stream error:"))) {
        yield {
          type: "stream:disconnected",
          reason: err instanceof Error ? err.message : "Unknown error",
        };
      }

      if (!shouldReconnect) {
        throw err;
      }
    }

    if (!shouldReconnect) break;

    await new Promise((r) => setTimeout(r, reconnectDelay));
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }
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
