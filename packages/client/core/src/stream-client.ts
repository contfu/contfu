import {
  EventType,
  SourceType,
  WIRE_PING,
  WIRE_SNAPSHOT_START,
  WIRE_SNAPSHOT_END,
  type CollectionSchema,
  type Item as InternalItem,
  type PageProps,
  type Block,
  type WireEvent,
  type WireItem,
} from "@contfu/core";
import { unpack } from "msgpackr";

/** Item as received by consumers — collection is the collection name. */
export type Item<T extends PageProps = Record<never, never>> = Omit<
  InternalItem<T>,
  "collection" | "ref"
> & {
  sourceType: SourceType | null;
  ref: string | null;
  collection: string;
};

export type ChangedEvent = { type: typeof EventType.CHANGED; item: Item; index: number };
export type DeletedEvent = { type: typeof EventType.DELETED; item: Buffer; index: number };
export type SchemaEvent = {
  type: typeof EventType.SCHEMA;
  collection: string;
  schema: CollectionSchema;
};
export type SyncEvent = ChangedEvent | DeletedEvent | SchemaEvent;
export type ItemEvent = SyncEvent;

/** Emitted when stream connection is established. */
export type StreamConnectedEvent = { type: "stream:connected" };

/** Emitted when stream connection is lost. */
export type StreamDisconnectedEvent = { type: "stream:disconnected"; reason?: string };

/** Emitted when server begins sending snapshot data. */
export type StreamSnapshotStartEvent = { type: "stream:snapshot:start" };

/** Emitted when server finishes sending snapshot data. */
export type StreamSnapshotEndEvent = { type: "stream:snapshot:end" };

/** Connection lifecycle events. */
export type StreamEvent =
  | StreamConnectedEvent
  | StreamDisconnectedEvent
  | StreamSnapshotStartEvent
  | StreamSnapshotEndEvent;

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
  /** Enable automatic reconnection on disconnect (default: true) */
  reconnect?: boolean;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialReconnectDelay?: number;
};

type OptsWithConnectionEvents = BaseOpts & { connectionEvents: true };
type OptsWithoutConnectionEvents = BaseOpts & { connectionEvents?: false };

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

  const baseUrl = apiUrl.replace(/\/$/, "");
  const syncEndpoint = /\/sync(?:$|\?)/.test(baseUrl) ? baseUrl : `${baseUrl}/sync`;
  const ackEndpoint = buildAckUrl(syncEndpoint, key);

  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = true;
  let nextFrom = from;
  let lastAckedFrom: number | null = null;
  let ackTimer: ReturnType<typeof setInterval> | null = null;
  let lastStreamActivityAt = 0;
  let currentReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  const startAckTimer = () => {
    lastStreamActivityAt = Date.now();
    ackTimer = setInterval(() => {
      // Stall detection: server pings every 10s, so 45s means ~3 missed pings
      if (Date.now() - lastStreamActivityAt > 45_000) {
        if (currentReader) {
          void currentReader.cancel("Stream stalled");
        }
        return;
      }

      // Send ack if we have a new sequence to acknowledge
      if (nextFrom != null && nextFrom !== lastAckedFrom) {
        const seq = nextFrom - 1;
        lastAckedFrom = nextFrom;
        void sendAck(ackEndpoint, seq);
      }
    }, 30_000);
  };

  const stopAckTimer = () => {
    if (ackTimer) {
      clearInterval(ackTimer);
      ackTimer = null;
    }
    currentReader = null;
  };

  while (shouldReconnect) {
    try {
      const syncUrl = buildSyncUrl(syncEndpoint, key, nextFrom);
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

      reconnectDelay = initialReconnectDelay;
      startAckTimer();
      if (connectionEvents) {
        yield { type: "stream:connected" };
      }

      const reader = response.body.getReader();
      currentReader = reader;
      let buffer = new Uint8Array(0);

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          stopAckTimer();
          if (connectionEvents) {
            yield { type: "stream:disconnected", reason: "Stream ended" };
          }
          break;
        }
        lastStreamActivityAt = Date.now();

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

          const wireEvent = unpack(messageData) as WireEvent;
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
      }
    } catch (err) {
      stopAckTimer();
      if (connectionEvents && !(err instanceof Error && err.message.startsWith("Stream error:"))) {
        yield {
          type: "stream:disconnected",
          reason: err instanceof Error ? err.message : "Unknown error",
        };
      }

      if (!shouldReconnect || !reconnect) {
        throw err;
      }
    }

    if (!reconnect) break;
    if (!shouldReconnect) break;

    await new Promise((r) => setTimeout(r, reconnectDelay));
    reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
  }
}

function buildAckUrl(syncEndpoint: string, key: Buffer): string {
  const base = syncEndpoint.replace(/\/sync(?:\?.*)?$/, "/sync/ack");
  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  return `${base}?${params.toString()}`;
}

async function sendAck(baseUrl: string, seq: number): Promise<void> {
  try {
    await fetch(`${baseUrl}&seq=${seq}`, { method: "POST" });
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

function fromWireStreamEvent(
  wireEvent: WireEvent,
): StreamSnapshotStartEvent | StreamSnapshotEndEvent | null {
  const type = wireEvent[0];
  if (type === WIRE_SNAPSHOT_START) return { type: "stream:snapshot:start" };
  if (type === WIRE_SNAPSHOT_END) return { type: "stream:snapshot:end" };
  return null;
}

function fromWireEvent(wireEvent: WireEvent): SyncEvent | null {
  const type = wireEvent[0];

  switch (type) {
    case EventType.CHANGED: {
      const wireItem = wireEvent[1] as WireItem;
      const [sourceType, ref, id, collection, changedAt, props, content] = wireItem;
      const index = wireEvent[2];

      if (typeof index !== "number") {
        console.warn("Ignoring CHANGED event without sync index");
        return null;
      }

      const item: Item = {
        sourceType,
        ref: typeof ref === "string" ? ref : null,
        id: Buffer.from(id),
        collection,
        changedAt,
        props: deserializeProps(props),
      };
      if (content) {
        item.content = content as Block[];
      }

      return { type: EventType.CHANGED, item, index };
    }

    case EventType.DELETED: {
      const index = wireEvent[2];
      if (typeof index !== "number") {
        console.warn("Ignoring DELETED event without sync index");
        return null;
      }

      return {
        type: EventType.DELETED,
        item: Buffer.from(wireEvent[1] as Uint8Array),
        index,
      };
    }

    case EventType.SCHEMA: {
      const [, collection, schema] = wireEvent;
      return {
        type: EventType.SCHEMA,
        collection: collection as string,
        schema: schema as CollectionSchema,
      };
    }

    case WIRE_PING:
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
      result[key] = (value as Uint8Array[]).map((arr) => Buffer.from(arr));
    } else {
      result[key] = value;
    }
  }
  return result;
}
