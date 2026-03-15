import {
  ClientEventType,
  EventType,
  ConnectionType,
  type CollectionSchema,
  type Item as InternalItem,
  type PageProps,
  type Block,
  type WireEvent,
  type ClientWireEvent,
} from "@contfu/core";
import { pack, unpack } from "msgpackr";

/** Item as received by consumers — collection is the collection name. */
export type Item<T extends PageProps = Record<never, never>> = Omit<
  InternalItem<T>,
  "collection" | "ref"
> & {
  connectionType: ConnectionType | null;
  ref: string | null;
  collection: string;
};

export type ItemChangedEvent = { type: typeof EventType.ITEM_CHANGED; item: Item; index: number };
export type ItemDeletedEvent = { type: typeof EventType.ITEM_DELETED; item: Buffer; index: number };
export type SchemaEvent = {
  type: typeof EventType.COLLECTION_SCHEMA;
  collection: string;
  displayName: string;
  schema: CollectionSchema;
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

/** Emitted when server begins sending snapshot data. */
export type StreamSnapshotStartEvent = { type: typeof EventType.SNAPSHOT_START };

/** Emitted when server finishes sending snapshot data. */
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
  /** Consumer key. If not provided, CONTFU_API_KEY env var (base64url) is used. */
  key?: Buffer;
  /** Sync endpoint URL. Defaults to CONTFU_API_URL env var or http://localhost:5173/api/sync */
  url?: string;
  /** Event index to replay from. Events since this index will be replayed before live events. */
  from?: number;
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
  events(): AsyncGenerator<WireEvent>;
  sendAck(seq: number): Promise<void>;
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
    from,
    reconnect = false,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
    connectionEvents = false,
  } = opts;

  const apiUrl = opts.url ?? getEnv("CONTFU_API_URL") ?? "http://localhost:5173/api";
  const envKeyStr = getEnv("CONTFU_API_KEY");
  const key = opts.key ?? (envKeyStr ? Buffer.from(envKeyStr, "base64url") : undefined);
  if (!key) {
    throw new Error("No consumer key provided. Pass opts.key or set CONTFU_API_KEY.");
  }

  const transport = resolveSyncTransport(opts.transport);
  const baseUrl = apiUrl.replace(/\/$/, "");
  const syncEndpoint = /\/sync(?:$|\?)/.test(baseUrl) ? baseUrl : `${baseUrl}/sync`;

  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = true;
  let nextFrom = from;
  let lastAckedFrom: number | null = null;
  let ackTimer: ReturnType<typeof setInterval> | null = null;
  let lastStreamActivityAt = 0;
  let currentConnection: TransportConnection | null = null;

  const stopAckTimer = () => {
    if (ackTimer) {
      clearInterval(ackTimer);
      ackTimer = null;
    }
    currentConnection = null;
  };

  const startAckTimer = () => {
    lastStreamActivityAt = Date.now();
    ackTimer = setInterval(() => {
      if (transport === "http" && Date.now() - lastStreamActivityAt > 45_000) {
        currentConnection?.close("Stream stalled");
        return;
      }

      if (nextFrom != null && nextFrom !== lastAckedFrom) {
        const seq = nextFrom - 1;
        lastAckedFrom = nextFrom;
        void currentConnection?.sendAck(seq);
      }
    }, 30_000);
  };

  while (shouldReconnect) {
    try {
      const connection = await openTransportConnection(transport, syncEndpoint, key, nextFrom);
      currentConnection = connection;

      reconnectDelay = initialReconnectDelay;
      startAckTimer();
      if (connectionEvents) {
        yield { type: EventType.STREAM_CONNECTED };
      }

      for await (const wireEvent of connection.events()) {
        lastStreamActivityAt = Date.now();

        const streamEvent = fromWireStreamEvent(wireEvent);
        if (streamEvent) {
          if (connectionEvents) {
            yield streamEvent;
          }
          continue;
        }

        const event = fromWireEvent(wireEvent);
        if (event) {
          if ("index" in event && typeof event.index === "number") {
            nextFrom = event.index + 1;
          }
          yield event;
        }
      }

      stopAckTimer();
      if (connectionEvents) {
        yield {
          type: EventType.STREAM_DISCONNECTED,
          reason: connection.getDisconnectReason() ?? "Stream ended",
        };
      }
    } catch (err) {
      stopAckTimer();
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

    if (!reconnect) break;
    if (!shouldReconnect) break;

    await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }
}

async function openTransportConnection(
  transport: StreamTransport,
  syncEndpoint: string,
  key: Buffer,
  from?: number,
): Promise<TransportConnection> {
  if (transport === "websocket") {
    return openWebSocketConnection(syncEndpoint, key, from);
  }
  return openHttpConnection(syncEndpoint, key, from);
}

async function openHttpConnection(
  syncEndpoint: string,
  key: Buffer,
  from?: number,
): Promise<TransportConnection> {
  const syncUrl = buildSyncUrl(syncEndpoint, key, from);
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
          disconnectReason = "Stream ended";
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
          yield unpack(messageData) as WireEvent;
        }
      }
    },
    sendAck(seq: number) {
      return sendAck(`${ackEndpoint}&seq=${seq}`);
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
  from?: number,
): Promise<TransportConnection> {
  const wsUrl = buildWebSocketUrl(syncEndpoint, key, from);
  const socket = await createWebSocket(wsUrl);
  let disconnectReason: string | undefined;

  return {
    async *events() {
      const queue = createAsyncQueue<WireEvent>();

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
          queue.push(unpack(payload) as WireEvent);
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
    sendAck(seq: number) {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve();
      }
      const message: ClientWireEvent = [ClientEventType.ACK, seq];
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

function buildSyncUrl(endpoint: string, key: Buffer, from?: number): string {
  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  if (from != null) {
    params.set("from", from.toString());
  }
  const separator = endpoint.includes("?") ? "&" : "?";
  return `${endpoint}${separator}${params.toString()}`;
}

function buildWebSocketUrl(endpoint: string, key: Buffer, from?: number): string {
  const httpUrl = new URL(buildSyncUrl(endpoint, key, from));
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

function fromWireEvent(wireEvent: WireEvent): SyncEvent | null {
  const type = wireEvent[0];

  switch (type) {
    case EventType.ITEM_CHANGED: {
      const wireItem = wireEvent[1];
      const [connectionType, ref, id, collection, changedAt, props, content] = wireItem;
      const index = wireEvent[2];

      if (typeof index !== "number") {
        console.warn("Ignoring ITEM_CHANGED event without sync index");
        return null;
      }

      const item: Item = {
        connectionType,
        ref: typeof ref === "string" ? ref : null,
        id: Buffer.from(id),
        collection,
        changedAt,
        props: deserializeProps(props),
      };
      if (content) {
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

      return {
        type: EventType.ITEM_DELETED,
        item: Buffer.from(wireEvent[1] as Uint8Array),
        index,
      };
    }

    case EventType.COLLECTION_SCHEMA: {
      const [, collection, displayName, schema] = wireEvent;
      return {
        type: EventType.COLLECTION_SCHEMA,
        collection: collection as string,
        displayName: displayName as string,
        schema: schema as CollectionSchema,
      };
    }

    case EventType.COLLECTION_RENAMED: {
      const [, oldName, newName, newDisplayName] = wireEvent;
      return {
        type: EventType.COLLECTION_RENAMED,
        oldName: oldName as string,
        newName: newName as string,
        newDisplayName: newDisplayName as string,
      };
    }

    case EventType.COLLECTION_REMOVED: {
      const [, collection] = wireEvent;
      return {
        type: EventType.COLLECTION_REMOVED,
        collection: collection as string,
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
