import {
  ClientEventType,
  EventType,
  type CollectionSchema,
  type EffectiveCollectionI18nConfig,
  type Item as InternalItem,
  type PageProps,
  type Block,
  type WireEvent,
  type WireStreamPayload,
  type ClientWireEvent,
  materializeWireItemPatch,
  type WireItem,
  MINUTES,
  SECONDS,
} from "@contfu/core";
import { pack, unpack } from "msgpackr";

/** Item as received by consumers — collection is the collection name. */
export type Item<T extends PageProps = Record<never, never>> = Omit<
  InternalItem<T>,
  "collection" | "ref" | "id"
> & {
  id: number;
  collection: string;
};

export type ItemChangedEvent = { type: typeof EventType.ITEM_CHANGED; item: Item; index: number };
export type ItemDeletedEvent = { type: typeof EventType.ITEM_DELETED; item: number; index: number };
export type SchemaEvent = {
  type: typeof EventType.COLLECTION_SCHEMA;
  collection: string;
  displayName: string;
  schema: CollectionSchema;
  i18n?: EffectiveCollectionI18nConfig;
};
export type CollectionRenamedEvent = {
  type: typeof EventType.COLLECTION_RENAMED;
  oldName: string;
  newName: string;
  newDisplayName: string;
};
export type CollectionRemovedEvent = {
  type: typeof EventType.COLLECTION_REMOVED;
  collection: string;
};
export type SyncEvent =
  | ItemChangedEvent
  | ItemDeletedEvent
  | SchemaEvent
  | CollectionRenamedEvent
  | CollectionRemovedEvent;
export type ItemEvent = SyncEvent;

/** Emitted when stream connection is established. */
export type StreamConnectedEvent = { type: typeof EventType.STREAM_CONNECTED };

/** Emitted when stream connection is lost. */
export type StreamDisconnectedEvent = {
  type: typeof EventType.STREAM_DISCONNECTED;
  reason?: string;
};

/** Emitted when the Cloud Service begins sending snapshot Sync Messages. */
export type StreamSnapshotStartEvent = { type: typeof EventType.SNAPSHOT_START };

/** Emitted when the Cloud Service finishes sending snapshot Sync Messages. */
export type StreamSnapshotEndEvent = { type: typeof EventType.SNAPSHOT_END };

/** Connection lifecycle events. */
export type StreamEvent =
  | StreamConnectedEvent
  | StreamDisconnectedEvent
  | StreamSnapshotStartEvent
  | StreamSnapshotEndEvent;

export type StreamTransport = "http" | "websocket";

function getEnv(name: string): string | undefined {
  const g = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return g.process?.env?.[name];
}

type BaseOpts = {
  /** Authentication key. If not provided, CONTFU_KEY env var (base64url) is used. */
  key?: Buffer;
  /** Explicit transport override. Defaults to runtime selection. */
  transport?: StreamTransport;
  /** Enable automatic reconnection on disconnect (default: true) */
  reconnect?: boolean;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialReconnectDelay?: number;
};

type OptsWithConnectionEvents = BaseOpts & { connectionEvents: true };
type OptsWithoutConnectionEvents = BaseOpts & { connectionEvents?: false };

type TransportConnection = {
  events(): AsyncGenerator<WireStreamPayload>;
  sendAck(): Promise<void>;
  close(reason: string): void;
  getDisconnectReason(): string | undefined;
};

export function resolveSyncTransport(explicit?: StreamTransport): StreamTransport {
  if (explicit) return explicit;

  const forced = getEnv("CONTFU_SYNC_TRANSPORT");
  if (forced === "http" || forced === "websocket") {
    return forced;
  }

  return getEnv("NODE_ENV") === "production" || getEnv("VITE_PREVIEW") != null
    ? "websocket"
    : "http";
}

export function connectToStream(
  opts: OptsWithConnectionEvents,
): AsyncGenerator<SyncEvent | StreamEvent>;
export function connectToStream(opts?: OptsWithoutConnectionEvents): AsyncGenerator<SyncEvent>;
export async function* connectToStream(
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): AsyncGenerator<SyncEvent | StreamEvent> {
  const {
    reconnect = false,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
    connectionEvents = false,
  } = opts;

  const rawUrl = getEnv("CONTFU_URL") ?? "https://contfu.com";
  const envKeyStr = getEnv("CONTFU_KEY");
  const key = opts.key ?? (envKeyStr ? Buffer.from(envKeyStr, "base64url") : undefined);
  if (!key) {
    throw new Error("No authentication key provided. Pass opts.key or set CONTFU_KEY.");
  }

  const transport = resolveSyncTransport(opts.transport);
  const baseUrl = rawUrl.replace(/\/$/, "");
  const syncEndpoint = /\/api\/sync(?:$|\?)/.test(baseUrl) ? baseUrl : `${baseUrl}/api/sync`;

  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = true;
  let lastStreamActivityAt = 0;
  let currentConnection: TransportConnection | null = null;
  const materializedItems = new Map<string, WireItem>();

  const stopStallTimer = () => {
    if (stallTimer) {
      clearInterval(stallTimer);
      stallTimer = null;
    }
  };

  let stallTimer: Timer | null = null;
  const startStallTimer = () => {
    lastStreamActivityAt = Date.now();
    stallTimer = setInterval(() => {
      const timeout = transport === "http" ? 45 * SECONDS : 10 * MINUTES;
      if (Date.now() - lastStreamActivityAt > timeout) currentConnection?.close("Stream stalled");
    }, 30 * SECONDS);
  };

  try {
    while (shouldReconnect) {
      let connection: TransportConnection | null = null;

      try {
        connection = await openTransportConnection(transport, syncEndpoint, key);
        currentConnection = connection;
        materializedItems.clear();

        reconnectDelay = initialReconnectDelay;
        startStallTimer();
        if (connectionEvents) {
          yield { type: EventType.STREAM_CONNECTED };
        }

        for await (const payload of connection.events()) {
          lastStreamActivityAt = Date.now();
          const wireEvents = isWireEventBatch(payload) ? payload : [payload];
          const shouldAckBatch = isWireEventBatch(payload) || !isPingEvent(payload);

          for (const wireEvent of wireEvents) {
            const streamEvent = fromWireStreamEvent(wireEvent);
            if (streamEvent) {
              if (streamEvent.type === EventType.SNAPSHOT_START) materializedItems.clear();
              if (connectionEvents) yield streamEvent;
              continue;
            }

            const event = fromWireEvent(wireEvent, materializedItems);
            if (event) yield event;
          }

          if (shouldAckBatch) await connection.sendAck();
        }

        stopStallTimer();
        if (connectionEvents) {
          yield {
            type: EventType.STREAM_DISCONNECTED,
            reason: connection.getDisconnectReason() ?? "Stream ended",
          };
        }
      } catch (err) {
        stopStallTimer();
        connection?.close("Stream error");
        if (connectionEvents) {
          yield {
            type: EventType.STREAM_DISCONNECTED,
            reason: err instanceof Error ? err.message : "Unknown error",
          };
        }

        if (!shouldReconnect || !reconnect) {
          throw err;
        }
      }

      if (currentConnection === connection) {
        currentConnection = null;
      }

      if (!reconnect) break;
      if (!shouldReconnect) break;

      await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
    }
  } finally {
    shouldReconnect = false;
    const connection = currentConnection;
    currentConnection = null;
    stopStallTimer();
    connection?.close("Stream consumer stopped");
  }
}

async function openTransportConnection(
  transport: StreamTransport,
  syncEndpoint: string,
  key: Buffer,
): Promise<TransportConnection> {
  if (transport === "websocket") {
    return openWebSocketConnection(syncEndpoint, key);
  }
  return openHttpConnection(syncEndpoint, key);
}

async function openHttpConnection(syncEndpoint: string, key: Buffer): Promise<TransportConnection> {
  const syncUrl = buildSyncUrl(syncEndpoint, key);
  const ackEndpoint = buildAckUrl(syncEndpoint, key);
  const response = await fetch(syncUrl, {
    headers: { Accept: "application/octet-stream" },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sync connection failed: ${response.status} ${text}`);
  }

  if (!response.body) {
    throw new Error("Streaming not supported in this environment");
  }

  const reader = response.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  let disconnectReason: string | undefined;

  return {
    async *events() {
      let buffer = new Uint8Array(0);

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          disconnectReason ??= "Stream ended";
          return;
        }

        const newBuffer = new Uint8Array(buffer.length + value.length);
        newBuffer.set(buffer);
        newBuffer.set(value, buffer.length);
        buffer = newBuffer;

        while (buffer.length >= 4) {
          const view = new DataView(buffer.buffer, buffer.byteOffset, 4);
          const messageLength = view.getUint32(0, false);

          if (buffer.length < 4 + messageLength) break;

          const messageData = buffer.slice(4, 4 + messageLength);
          buffer = buffer.slice(4 + messageLength);
          yield unpack(messageData) as WireStreamPayload;
        }
      }
    },
    sendAck() {
      return sendAck(ackEndpoint);
    },
    close(reason: string) {
      disconnectReason = reason;
      void reader.cancel(reason);
    },
    getDisconnectReason() {
      return disconnectReason;
    },
  };
}

async function openWebSocketConnection(
  syncEndpoint: string,
  key: Buffer,
): Promise<TransportConnection> {
  const wsUrl = buildWebSocketUrl(syncEndpoint, key);
  const socket = await createWebSocket(wsUrl);
  let disconnectReason: string | undefined;

  return {
    async *events() {
      const queue = createAsyncQueue<WireStreamPayload>();

      socket.binaryType = "arraybuffer";
      socket.onmessage = (message) => {
        try {
          const payload =
            message.data instanceof ArrayBuffer
              ? new Uint8Array(message.data)
              : message.data instanceof Blob
                ? null
                : new Uint8Array(message.data as ArrayBufferLike);
          if (!payload) return;
          queue.push(unpack(payload) as WireStreamPayload);
        } catch (error) {
          queue.fail(error instanceof Error ? error : new Error("Invalid WebSocket message"));
        }
      };
      socket.onerror = () => {
        queue.fail(new Error("WebSocket connection failed"));
      };
      socket.onclose = (event) => {
        disconnectReason = event.reason || `WebSocket closed (${event.code})`;
        queue.finish();
      };

      yield* queue.iterate();
    },
    sendAck() {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve();
      }
      const message: ClientWireEvent = [ClientEventType.ACK];
      socket.send(pack(message));
      return Promise.resolve();
    },
    close(reason: string) {
      disconnectReason = reason;
      socket.close(1000, reason);
    },
    getDisconnectReason() {
      return disconnectReason;
    },
  };
}

function buildAckUrl(syncEndpoint: string, key: Buffer): string {
  const base = syncEndpoint.replace(/\/sync(?:\?.*)?$/, "/sync/ack");
  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  return `${base}?${params.toString()}`;
}

async function sendAck(url: string): Promise<void> {
  try {
    await fetch(url, { method: "POST" });
  } catch {
    // ignore ack transport failures; stream reconnection handles hard failures
  }
}

function buildSyncUrl(endpoint: string, key: Buffer): string {
  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${params.toString()}`;
}

function buildWebSocketUrl(endpoint: string, key: Buffer): string {
  const httpUrl = new URL(buildSyncUrl(endpoint, key));
  httpUrl.protocol = httpUrl.protocol === "https:" ? "wss:" : "ws:";
  return httpUrl.toString();
}

function fromWireStreamEvent(
  wireEvent: WireEvent,
): StreamSnapshotStartEvent | StreamSnapshotEndEvent | null {
  if (wireEvent.length !== 1) return null;
  const type = wireEvent[0];
  if (type === EventType.SNAPSHOT_START) return { type: EventType.SNAPSHOT_START };
  if (type === EventType.SNAPSHOT_END) return { type: EventType.SNAPSHOT_END };
  return null;
}

function itemStateKey(collection: string, id: number): string {
  return `${collection}:${id}`;
}

function fromWireEvent(
  wireEvent: WireEvent,
  materializedItems: Map<string, WireItem>,
): SyncEvent | null {
  const type = wireEvent[0];

  switch (type) {
    case EventType.ITEM_CHANGED: {
      const wirePatch = wireEvent[1];
      const [id, collection] = wirePatch;
      const index = wireEvent[2];

      if (typeof index !== "number") {
        console.warn("Ignoring ITEM_CHANGED event without sync index");
        return null;
      }

      const key = itemStateKey(collection, id);
      const wireItem = materializeWireItemPatch(wirePatch, materializedItems.get(key));
      materializedItems.set(key, wireItem);
      const [, , changedAt, props, content] = wireItem;
      const item: Item = {
        id,
        collection,
        changedAt,
        props: deserializeProps(props),
      };
      if (wireItem.length > 4) {
        item.content = content as Block[];
      }

      return { type: EventType.ITEM_CHANGED, item, index };
    }

    case EventType.ITEM_DELETED: {
      const index = wireEvent[2];
      if (typeof index !== "number") {
        console.warn("Ignoring ITEM_DELETED event without sync index");
        return null;
      }

      for (const key of materializedItems.keys()) {
        if (key.endsWith(`:${wireEvent[1]}`)) materializedItems.delete(key);
      }
      return {
        type: EventType.ITEM_DELETED,
        item: wireEvent[1],
        index,
      };
    }

    case EventType.COLLECTION_SCHEMA: {
      const [, collection, displayName, schema, i18n] = wireEvent;
      return {
        type: EventType.COLLECTION_SCHEMA,
        collection: collection,
        displayName: displayName,
        schema: schema,
        i18n: i18n,
      };
    }

    case EventType.COLLECTION_RENAMED: {
      const [, oldName, newName, newDisplayName] = wireEvent;
      return {
        type: EventType.COLLECTION_RENAMED,
        oldName: oldName,
        newName: newName,
        newDisplayName: newDisplayName,
      };
    }

    case EventType.COLLECTION_REMOVED: {
      const [, collection] = wireEvent;
      return {
        type: EventType.COLLECTION_REMOVED,
        collection: collection,
      };
    }

    case EventType.PING:
      return null;

    default:
      console.warn(`Unknown wire event type: ${type}`);
      return null;
  }
}

function deserializeProps(props: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Array.isArray(value) && value.length > 0 && value[0] instanceof Uint8Array) {
      result[key] = (value as Uint8Array[]).map((buf) => Buffer.from(buf));
    } else {
      result[key] = value;
    }
  }
  return result;
}

function createWebSocket(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    socket.onopen = () => resolve(socket);
    socket.onerror = () => reject(new Error("WebSocket connection failed"));
  });
}

function createAsyncQueue<T>() {
  const values: T[] = [];
  const waiters: Array<(value: IteratorResult<T>) => void> = [];
  let failure: Error | null = null;
  let done = false;

  return {
    push(value: T) {
      if (done) return;
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value, done: false });
      } else {
        values.push(value);
      }
    },
    fail(error: Error) {
      if (done) return;
      failure = error;
      done = true;
      while (waiters.length > 0) {
        const waiter = waiters.shift();
        waiter?.({ value: undefined as T, done: true });
      }
    },
    finish() {
      if (done) return;
      done = true;
      while (waiters.length > 0) {
        const waiter = waiters.shift();
        waiter?.({ value: undefined as T, done: true });
      }
    },
    async *iterate(): AsyncGenerator<T> {
      while (true) {
        if (values.length > 0) {
          yield values.shift() as T;
          continue;
        }
        if (failure) {
          throw failure;
        }
        if (done) {
          return;
        }
        const next = await new Promise<IteratorResult<T>>((resolve) => waiters.push(resolve));
        if (failure) {
          throw failure;
        }
        if (next.done) {
          return;
        }
        yield next.value;
      }
    },
  };
}

function isWireEventBatch(payload: WireStreamPayload): payload is WireEvent[] {
  return Array.isArray(payload) && Array.isArray(payload[0]);
}

function isPingEvent(payload: WireStreamPayload): boolean {
  return payload[0] === EventType.PING;
}
