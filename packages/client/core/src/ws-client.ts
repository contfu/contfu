import {
  
  
  ConnectedEvent,
  
  ErrorEvent,
  EventType,
  Item,
  ItemEvent,
  
} from "@contfu/core";
import { unpack } from "msgpackr";

/**
 * Wire format for WebSocket events (matches server).
 * Uses tuples for minimal MessagePack encoding size.
 * 
 * Format: [type, ...payload]
 * - CONNECTED: [0]
 * - CHANGED: [1, [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]]
 * - DELETED: [2, deletedItemId]
 * - LIST_IDS: [3, collection, ids[]]
 * - CHECKSUM: [4, collection, checksum]
 * - ERROR: [5, errorCode]
 */
type WireEvent =
  | [EventType.CONNECTED]
  | [EventType.CHANGED, WireItem]
  | [EventType.DELETED, Uint8Array]
  | [EventType.LIST_IDS, number, Uint8Array[]]
  | [EventType.CHECKSUM, number, Uint8Array]
  | [EventType.ERROR, string];

/**
 * Wire item format as tuple:
 * [ref, id, collection, publishedAt, createdAt, changedAt, props, content?]
 */
type WireItem = [
  Uint8Array, // ref
  Uint8Array, // id
  number, // collection
  number, // publishedAt (0 if undefined)
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

// WebSocket: browser has native, Bun/Node may need polyfill
let _WebSocketClass: typeof WebSocket | null = null;

function getWebSocketClass(): typeof WebSocket {
  if (_WebSocketClass) return _WebSocketClass;

  if (typeof WebSocket !== "undefined") {
    _WebSocketClass = WebSocket;
  } else if (typeof globalThis.WebSocket !== "undefined") {
    _WebSocketClass = globalThis.WebSocket;
  } else {
    throw new Error("WebSocket not available in this environment");
  }
  return _WebSocketClass;
}

export function connectToWS(
  key: Buffer,
  opts: Opts & { handle: (e: ItemEvent) => Promise<void> },
): Promise<void>;
export function connectToWS(
  key: Buffer,
  opts?: Omit<Opts, "handle">,
): Promise<AsyncGenerator<ItemEvent>>;
export async function connectToWS(
  key: Buffer,
  {
    url = "wss://contfu.com/api/ws",
    handle,
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
  }: Opts = {},
) {
  // Encode key as base64url for authentication header
  // Standard base64 has +, /, = which are invalid in Sec-WebSocket-Protocol
  const keyBase64 = key.toString("base64url");

  // Create event queue (persists across reconnections)
  const eventQueue: ItemEvent[] = [];
  let queueResolve: ((value: ItemEvent) => void) | null = null;

  let ws: WebSocket | null = null;
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

  const enqueueEvent = (event: ItemEvent) => {
    if (queueResolve) {
      queueResolve(event);
      queueResolve = null;
    } else {
      eventQueue.push(event);
    }
  };

  const connect = async (): Promise<void> => {
    if (ws) {
      ws.close();
    }

    const WebSocketImpl = getWebSocketClass();
    // Pass auth key via Sec-WebSocket-Protocol header (works in browser + Node/Bun)
    // Server echoes the protocol back to complete the handshake
    const authProtocol = `contfu.${keyBase64}`;
    ws = new WebSocketImpl(url, [authProtocol]);
    ws.binaryType = "arraybuffer";

    return new Promise<void>((res, rej) => {
      let resolved = false;

      const onOpen = () => {
        // Connection is authenticated if we get here (auth happens during upgrade)
        // Wait for CONNECTED event from server
      };

      const onMessage = async (event: MessageEvent) => {
        let wireEvent: WireEvent;
        try {
          if (event.data instanceof ArrayBuffer) {
            wireEvent = unpack(Buffer.from(event.data));
          } else if (typeof event.data === "string") {
            // Fallback JSON support
            wireEvent = JSON.parse(event.data);
          } else {
            console.error("Unknown message type:", typeof event.data);
            return;
          }
        } catch (err) {
          console.error("Failed to parse WebSocket message:", err);
          return;
        }

        const deserialized = fromWireEvent(wireEvent);

        // Handle connection success (auth already passed during upgrade)
        if (deserialized.type === EventType.CONNECTED) {
          if (!resolved) {
            resolved = true;
            reconnectDelay = initialReconnectDelay;
            res();
          }
          console.log("WebSocket CONNECTED");
          return;
        }

        // Handle errors
        if (deserialized.type === EventType.ERROR) {
          if (!resolved) {
            resolved = true;
            rej(new Error(`WebSocket error: ${deserialized.code}`));
          }
          ws?.close();
          return;
        }

        // Queue regular events
        enqueueEvent(deserialized as ItemEvent);
      };

      const onClose = async () => {
        if (!resolved) {
          // Never got CONNECTED event - auth may have failed during upgrade
          rej(new Error("WebSocket closed before receiving CONNECTED event"));
          return;
        }

        if (shouldReconnect && !isReconnecting) {
          isReconnecting = true;
          await new Promise((r) => setTimeout(r, reconnectDelay));
          reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
          try {
            isReconnecting = false;
            await connect();
            if (!resolved) {
              resolved = true;
              res();
            }
          } catch (err) {
            isReconnecting = false;
            if (!resolved) {
              rej(err);
            }
          }
        }
      };

      const onError = (event: Event) => {
        console.error("WebSocket error event:", event);
        // Error is followed by close, let onClose handle reconnection
      };

      ws!.addEventListener("open", onOpen);
      ws!.addEventListener("message", onMessage);
      ws!.addEventListener("close", onClose);
      ws!.addEventListener("error", onError);
    });
  };

  // Initial connection
  await connect();

  if (handle) {
    return (async () => {
      do {
        const event = await getNextEvent();
        await handle(event);
      } while (shouldReconnect || (ws as WebSocket | null)?.readyState === WebSocket.OPEN);
    })();
  }

  return (async function* () {
    do {
      yield await getNextEvent();
    } while (shouldReconnect || (ws as WebSocket | null)?.readyState === WebSocket.OPEN);
  })();
}

/**
 * Convert wire format (tuples) back to event types.
 */
function fromWireEvent(wire: WireEvent): ItemEvent | ErrorEvent | ConnectedEvent {
  const eventType = wire[0];

  switch (eventType) {
    case EventType.CONNECTED:
      return { type: EventType.CONNECTED };

    case EventType.CHANGED: {
      const wireItem = wire[1];
      const [ref, id, collection, publishedAt, createdAt, changedAt, props, content] = wireItem;
      const item: Item = {
        ref: Buffer.from(ref),
        id: Buffer.from(id),
        collection,
        createdAt,
        changedAt,
        props: deserializeProps(props),
      };
      // publishedAt: 0 means undefined
      if (publishedAt !== 0) item.publishedAt = publishedAt;
      // Content is Block[] - pass through as-is
      if (content) item.content = content as Item["content"];
      return { type: EventType.CHANGED, item };
    }

    case EventType.DELETED:
      return {
        type: EventType.DELETED,
        item: Buffer.from(wire[1]),
      };

    case EventType.LIST_IDS:
      return {
        type: EventType.LIST_IDS,
        collection: wire[1],
        ids: wire[2].map((id) => Buffer.from(id)),
      };

    case EventType.CHECKSUM:
      return {
        type: EventType.CHECKSUM,
        collection: wire[1],
        checksum: Buffer.from(wire[2]),
      };

    case EventType.ERROR:
      return {
        type: EventType.ERROR,
        code: wire[1] ?? "UNKNOWN",
      };

    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

/**
 * Deserialize props, converting Uint8Array back to Buffer.
 */
function deserializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (
      Array.isArray(value) &&
      value.length > 0 &&
      (value[0] instanceof Uint8Array || ArrayBuffer.isView(value[0]))
    ) {
      result[key] = value.map((v) => Buffer.from(v as Uint8Array));
    } else {
      result[key] = value;
    }
  }
  return result;
}
