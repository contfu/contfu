import {
  ClientEventType,
  ApplicationCommand,
  CommandResult,
  EventType,
  type RefreshStatus,
  type CollectionSchema,
  type EffectiveCollectionI18nConfig,
  type Item as InternalItem,
  type PageProps,
  type Block,
  type WireEvent,
  type WireStreamPayload,
  type ClientWireEvent,
  type WireCommand,
  type WireCommandResult,
  type WireLeaseRequest,
  type WireLeaseResponse,
  FileLeaseResultStatus,
  isWireLeaseResponse,
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

export type ItemChangedEvent = {
  type: typeof EventType.ITEM_CHANGED;
  item: Item;
  index: number;
};
export type ItemDeletedEvent = {
  type: typeof EventType.ITEM_DELETED;
  item: number;
  index: number;
};
export type SchemaEvent = {
  type: typeof EventType.COLLECTION_SCHEMA;
  collection: string;
  displayName: string;
  schema: CollectionSchema;
  i18n?: EffectiveCollectionI18nConfig;
  index: number;
};
export type CollectionRenamedEvent = {
  type: typeof EventType.COLLECTION_RENAMED;
  oldName: string;
  newName: string;
  newDisplayName: string;
  index: number;
};
export type CollectionRemovedEvent = {
  type: typeof EventType.COLLECTION_REMOVED;
  collection: string;
  index: number;
};
export type RefreshCommandResultEvent = {
  type: typeof CommandResult.REFRESH;
  commandId: number;
  status: RefreshStatus;
  ignoredItemIds?: number[];
};
export type RefreshAllCommandResultEvent = {
  type: typeof CommandResult.REFRESH_ALL;
  commandId: number;
  status: RefreshStatus;
};
export type CommandResultEvent = RefreshCommandResultEvent | RefreshAllCommandResultEvent;

export type ItemEvent =
  | ItemChangedEvent
  | ItemDeletedEvent
  | SchemaEvent
  | CollectionRenamedEvent
  | CollectionRemovedEvent;
export type SyncEvent = ItemEvent | CommandResultEvent;

/** Emitted when stream connection is established. */
export type StreamConnectedEvent = { type: typeof EventType.STREAM_CONNECTED };

/** Emitted when stream connection is lost. */
export type StreamDisconnectedEvent = {
  type: typeof EventType.STREAM_DISCONNECTED;
  reason?: string;
};

/** Emitted when Contfu begins sending snapshot Sync Messages. */
export type StreamSnapshotStartEvent = {
  type: typeof EventType.SNAPSHOT_START;
};

/** Emitted when Contfu finishes sending snapshot Sync Messages. */
export type StreamSnapshotEndEvent = { type: typeof EventType.SNAPSHOT_END };

/** Connection lifecycle events. */
export type StreamEvent =
  | StreamConnectedEvent
  | StreamDisconnectedEvent
  | StreamSnapshotStartEvent
  | StreamSnapshotEndEvent;

type StreamTransport = "http" | "websocket";

function getEnv(name: string): string | undefined {
  const g = globalThis as {
    process?: { env?: Record<string, string | undefined> };
  };
  return g.process?.env?.[name];
}

const CONTFU_URL = "https://contfu.com";
const SYNC_TRANSPORT = "websocket";

type BaseOpts = {
  /** Authentication key. If not provided, CONTFU_KEY env var (base64url) is used. */
  key?: Buffer;
  /** Enable automatic reconnection on disconnect (default: true) */
  reconnect?: boolean;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialReconnectDelay?: number;
  /** Yield command result events (default: true). Internal command result handling still runs. */
  commandResults?: boolean;
};

export type FileLease = { url: string; expiresAt: number };
const FILE_LEASE_REQUEST_TIMEOUT_MS = 5_000;
export type StreamCommandSender = {
  refresh(collection: string, itemIds: number[], source?: boolean): Promise<CommandResultEvent>;
  refreshAll(collection: string, source?: boolean): Promise<CommandResultEvent>;
  resolveFileLease?(
    integrationType: number,
    sourceCollectionId: string,
    itemId: string | number,
    handle: string,
  ): Promise<FileLease | null>;
};

export type StreamClient<T> = AsyncGenerator<T> & StreamCommandSender;

type OptsWithConnectionEvents = BaseOpts & { connectionEvents: true };
type OptsWithoutConnectionEvents = BaseOpts & { connectionEvents?: false };

type TransportConnection = {
  events(): AsyncGenerator<WireStreamPayload>;
  sendAck(): Promise<void>;
  sendCommand(command: WireCommand): Promise<WireCommandResult | void>;
  requestFileLease(request: WireLeaseRequest): Promise<void>;
  close(reason: string): void;
  getDisconnectReason(): string | undefined;
};

export function connectToStream(
  opts: OptsWithConnectionEvents,
): StreamClient<SyncEvent | StreamEvent>;
export function connectToStream(opts?: OptsWithoutConnectionEvents): StreamClient<SyncEvent>;
export function connectToStream(
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): StreamClient<SyncEvent | StreamEvent> {
  let currentConnection: TransportConnection | null = null;
  let cancelStream: (() => void) | null = null;
  let nextCommandId = 1;
  const pendingCommands = new Map<
    number,
    {
      resolve: (event: CommandResultEvent) => void;
      reject: (error: Error) => void;
    }
  >();
  const pendingLeases = new Map<
    number,
    {
      resolve: (lease: FileLease | null) => void;
      reject: (error: Error) => void;
      timer?: Timer;
    }
  >();
  let nextLeaseRequestId = 1;

  const sendCommand = async (command: WireCommand): Promise<CommandResultEvent> => {
    const commandId = command[1];
    if (!currentConnection) throw new Error("Sync command failed: no active stream connection");
    const resultPromise = new Promise<CommandResultEvent>((resolve, reject) => {
      pendingCommands.set(commandId, { resolve, reject });
    });
    let result: WireCommandResult | void;
    try {
      result = await currentConnection.sendCommand(command);
    } catch (error) {
      pendingCommands.delete(commandId);
      throw error;
    }
    if (result) {
      const event = fromWireCommandResult(result);
      if (event) {
        pendingCommands.delete(commandId);
        return event;
      }
    }
    return resultPromise;
  };

  const generator = streamEvents(opts, {
    getCurrentConnection: () => currentConnection,
    setCurrentConnection: (connection) => {
      currentConnection = connection;
    },
    setCancelStream: (cancel) => {
      cancelStream = cancel;
    },
    pendingCommands,
    pendingLeases,
  }) as StreamClient<SyncEvent | StreamEvent>;

  const returnGenerator = generator.return.bind(generator);
  generator.return = (value?: SyncEvent | StreamEvent) => {
    const connection = currentConnection;
    currentConnection = null;
    cancelStream?.();
    connection?.close("Stream consumer stopped");
    rejectPendingCommands(pendingCommands, "Stream consumer stopped");
    rejectPendingLeases(pendingLeases, "Stream consumer stopped");
    return returnGenerator(value);
  };

  generator.refresh = (collection, itemIds, source) => {
    const commandId = nextCommandId++;
    return sendCommand(
      source === undefined
        ? [ApplicationCommand.REFRESH, commandId, collection, itemIds]
        : [ApplicationCommand.REFRESH, commandId, collection, itemIds, source],
    );
  };
  generator.refreshAll = (collection, source) => {
    const commandId = nextCommandId++;
    return sendCommand(
      source === undefined
        ? [ApplicationCommand.REFRESH_ALL, commandId, collection]
        : [ApplicationCommand.REFRESH_ALL, commandId, collection, source],
    );
  };
  generator.resolveFileLease = async (integrationType, sourceCollectionId, itemId, handle) => {
    const connection = currentConnection;
    if (!connection?.requestFileLease) return null;
    const requestId = nextLeaseRequestId++;
    const result = new Promise<FileLease | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!pendingLeases.has(requestId)) return;
        pendingLeases.delete(requestId);
        resolve(null);
      }, FILE_LEASE_REQUEST_TIMEOUT_MS);
      pendingLeases.set(requestId, { resolve, reject, timer });
    });
    try {
      await connection.requestFileLease([
        ClientEventType.FILE_LEASE_REQUEST,
        requestId,
        integrationType,
        sourceCollectionId,
        itemId,
        handle,
      ]);
    } catch (error) {
      const pending = pendingLeases.get(requestId);
      if (pending) {
        pendingLeases.delete(requestId);
        if (pending.timer !== undefined) clearTimeout(pending.timer);
        pending.reject(error as Error);
      }
      return result;
    }
    return result;
  };

  return generator;
}

async function* streamEvents(
  opts: BaseOpts & { connectionEvents?: boolean } = {},
  state: {
    getCurrentConnection: () => TransportConnection | null;
    setCurrentConnection: (connection: TransportConnection | null) => void;
    setCancelStream: (cancel: (() => void) | null) => void;
    pendingCommands: Map<
      number,
      {
        resolve: (event: CommandResultEvent) => void;
        reject: (error: Error) => void;
      }
    >;
    pendingLeases: Map<
      number,
      {
        resolve: (lease: FileLease | null) => void;
        reject: (error: Error) => void;
        timer?: Timer;
      }
    >;
  },
): AsyncGenerator<SyncEvent | StreamEvent> {
  const {
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
    connectionEvents = false,
    commandResults = true,
  } = opts;

  const envKeyStr = getEnv("CONTFU_KEY");
  const key = opts.key ?? (envKeyStr ? Buffer.from(envKeyStr, "base64url") : undefined);
  if (!key) {
    throw new Error("No authentication key provided. Pass opts.key or set CONTFU_KEY.");
  }

  const syncEndpoint = `${CONTFU_URL}/api/sync`;

  let reconnectDelay = initialReconnectDelay;
  let shouldReconnect = true;
  state.setCancelStream(() => {
    shouldReconnect = false;
  });
  let lastStreamActivityAt = 0;
  let activeTransport: StreamTransport = SYNC_TRANSPORT;
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
      const timeout = activeTransport === "http" ? 45 * SECONDS : 10 * MINUTES;
      if (Date.now() - lastStreamActivityAt > timeout)
        state.getCurrentConnection()?.close("Stream stalled");
    }, 30 * SECONDS);
  };

  try {
    while (shouldReconnect) {
      let connection: TransportConnection | null = null;

      try {
        const opened = await openDefaultTransportConnection(syncEndpoint, key, SYNC_TRANSPORT);
        connection = opened.connection;
        activeTransport = opened.transport;
        state.setCurrentConnection(connection);
        materializedItems.clear();

        reconnectDelay = initialReconnectDelay;
        startStallTimer();
        if (connectionEvents) {
          yield { type: EventType.STREAM_CONNECTED };
        }

        for await (const payload of connection.events()) {
          lastStreamActivityAt = Date.now();
          const wireEvents = isWireEventBatch(payload) ? payload : [payload];
          const shouldAckBatch =
            isWireEventBatch(payload) ||
            (!isPingEvent(payload) &&
              !isCommandResultPayload(payload) &&
              !isLeaseResponsePayload(payload));

          for (const wireEvent of wireEvents) {
            const leaseResponse = fromWireLeaseResponse(wireEvent);
            if (leaseResponse) {
              const [_, requestId, status, leaseUrl, expiresAt] = leaseResponse;
              const pending = state.pendingLeases.get(requestId);
              if (pending) {
                state.pendingLeases.delete(requestId);
                if (pending.timer !== undefined) clearTimeout(pending.timer);
                pending.resolve(
                  status === FileLeaseResultStatus.REDIRECT && leaseUrl && expiresAt
                    ? { url: leaseUrl, expiresAt }
                    : null,
                );
              }
              continue;
            }
            const streamEvent = fromWireStreamEvent(wireEvent);
            if (streamEvent) {
              if (streamEvent.type === EventType.SNAPSHOT_START) materializedItems.clear();
              if (connectionEvents) yield streamEvent;
              continue;
            }

            const commandResult = fromWireCommandResult(wireEvent);
            if (commandResult) {
              state.pendingCommands.get(commandResult.commandId)?.resolve(commandResult);
              state.pendingCommands.delete(commandResult.commandId);
              if (commandResults) yield commandResult;
              continue;
            }

            const event = fromWireEvent(wireEvent, materializedItems);
            if (event) yield event;
          }

          if (shouldAckBatch) await connection.sendAck();
        }

        stopStallTimer();
        if (state.getCurrentConnection() === connection) {
          state.setCurrentConnection(null);
        }
        rejectPendingCommands(
          state.pendingCommands,
          connection.getDisconnectReason() ?? "Stream ended",
        );
        rejectPendingLeases(
          state.pendingLeases,
          connection.getDisconnectReason() ?? "Stream ended",
        );
        if (connectionEvents) {
          yield {
            type: EventType.STREAM_DISCONNECTED,
            reason: connection.getDisconnectReason() ?? "Stream ended",
          };
        }
      } catch (err) {
        stopStallTimer();
        if (state.getCurrentConnection() === connection) {
          state.setCurrentConnection(null);
        }
        rejectPendingCommands(
          state.pendingCommands,
          err instanceof Error ? err.message : "Stream error",
        );
        rejectPendingLeases(
          state.pendingLeases,
          err instanceof Error ? err.message : "Stream error",
        );
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

      if (state.getCurrentConnection() === connection) {
        state.setCurrentConnection(null);
      }

      if (!reconnect) break;
      if (!shouldReconnect) break;

      await new Promise((resolve) => setTimeout(resolve, reconnectDelay));
      reconnectDelay = Math.min(reconnectDelay * 2, maxReconnectDelay);
    }
  } finally {
    shouldReconnect = false;
    const connection = state.getCurrentConnection();
    state.setCurrentConnection(null);
    stopStallTimer();
    connection?.close("Stream consumer stopped");
    rejectPendingCommands(state.pendingCommands, "Stream consumer stopped");
    rejectPendingLeases(state.pendingLeases, "Stream consumer stopped");
    state.setCancelStream(null);
  }
}

function rejectPendingCommands(
  pendingCommands: Map<
    number,
    {
      resolve: (event: CommandResultEvent) => void;
      reject: (error: Error) => void;
    }
  >,
  reason: string,
): void {
  const error = new Error(`Sync command failed: ${reason}`);
  for (const { reject } of pendingCommands.values()) reject(error);
  pendingCommands.clear();
}

function rejectPendingLeases(
  pendingLeases: Map<
    number,
    {
      resolve: (lease: FileLease | null) => void;
      reject: (error: Error) => void;
      timer?: Timer;
    }
  >,
  reason: string,
): void {
  const error = new Error(`File lease request failed: ${reason}`);
  for (const { reject, timer } of pendingLeases.values()) {
    if (timer !== undefined) clearTimeout(timer);
    reject(error);
  }
  pendingLeases.clear();
}

async function openDefaultTransportConnection(
  syncEndpoint: string,
  key: Buffer,
  transport: StreamTransport,
): Promise<{ transport: StreamTransport; connection: TransportConnection }> {
  if (transport === "http") {
    return {
      transport: "http",
      connection: await openHttpConnection(syncEndpoint, key),
    };
  }

  try {
    return {
      transport: "websocket",
      connection: await openWebSocketConnection(syncEndpoint, key),
    };
  } catch {
    return {
      transport: "http",
      connection: await openHttpConnection(syncEndpoint, key),
    };
  }
}

async function openHttpConnection(syncEndpoint: string, key: Buffer): Promise<TransportConnection> {
  const syncUrl = buildSyncUrl(syncEndpoint, key);
  const ackEndpoint = buildAckUrl(syncEndpoint, key);
  const commandEndpoint = buildCommandUrl(syncEndpoint, key);
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
        let chunk: { value?: Uint8Array; done: boolean };
        try {
          chunk = await reader.read();
        } catch (err) {
          if (disconnectReason && isExpectedHttpStreamCloseError(err)) return;
          throw err;
        }

        const { value, done } = chunk;
        if (done) {
          disconnectReason ??= "Stream ended";
          return;
        }
        if (!value) continue;

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
    requestFileLease() {
      return Promise.reject(new Error("File lease requests require a WebSocket sync connection"));
    },
    async sendCommand(command) {
      const response = await fetch(commandEndpoint, {
        method: "POST",
        headers: {
          Origin: new URL(commandEndpoint).origin,
          "Content-Type": "application/octet-stream",
          Accept: "application/octet-stream",
        },
        body: new Uint8Array(pack(command)),
      });
      if (!response.ok)
        throw new Error(`Sync command failed: ${response.status} ${await response.text()}`);
      return unpack(Buffer.from(await response.arrayBuffer())) as WireCommandResult;
    },
    close(reason: string) {
      disconnectReason = reason;
      void reader.cancel(reason).catch(() => undefined);
    },
    getDisconnectReason() {
      return disconnectReason;
    },
  };
}

function isExpectedHttpStreamCloseError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === "AbortError" || err.message === "terminated";
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
      socket.send(new Uint8Array(pack(message)));
      return Promise.resolve();
    },
    sendCommand(command) {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.resolve();
      }
      socket.send(new Uint8Array(pack(command)));
      return Promise.resolve();
    },
    requestFileLease(request) {
      if (socket.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error("WebSocket is not connected"));
      }
      socket.send(new Uint8Array(pack(request)));
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

function buildCommandUrl(syncEndpoint: string, key: Buffer): string {
  const base = syncEndpoint.replace(/\/sync(?:\?.*)?$/, "/sync/command");
  const params = new URLSearchParams();
  params.set("key", key.toString("base64url"));
  return `${base}?${params.toString()}`;
}

async function sendAck(url: string): Promise<void> {
  try {
    await fetch(url, {
      method: "POST",
      headers: { Origin: new URL(url).origin },
    });
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

function fromWireLeaseResponse(wireEvent: unknown): WireLeaseResponse | null {
  if (!isWireLeaseResponse(wireEvent)) return null;
  return wireEvent;
}

function fromWireCommandResult(wireEvent: unknown): CommandResultEvent | null {
  if (!Array.isArray(wireEvent)) return null;
  const type = wireEvent[0];
  if (type === CommandResult.REFRESH) {
    const [, commandId, status, ignoredItemIds] = wireEvent as WireCommandResult;
    if (typeof commandId !== "number" || typeof status !== "number") return null;
    return { type, commandId, status, ignoredItemIds };
  }
  if (type === CommandResult.REFRESH_ALL) {
    const [, commandId, status] = wireEvent as WireCommandResult;
    if (typeof commandId !== "number" || typeof status !== "number") return null;
    return { type, commandId, status };
  }
  return null;
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
      const [, collection, displayName, schema, i18n, maybeHashOrIndex, maybeIndex] = wireEvent;
      const index = typeof maybeHashOrIndex === "number" ? maybeHashOrIndex : maybeIndex;
      if (typeof index !== "number") {
        console.warn("Ignoring COLLECTION_SCHEMA event without sync index");
        return null;
      }
      return { type: EventType.COLLECTION_SCHEMA, collection, displayName, schema, i18n, index };
    }

    case EventType.COLLECTION_RENAMED: {
      const [, oldName, newName, newDisplayName, index] = wireEvent;
      if (typeof index !== "number") {
        console.warn("Ignoring COLLECTION_RENAMED event without sync index");
        return null;
      }
      return { type: EventType.COLLECTION_RENAMED, oldName, newName, newDisplayName, index };
    }

    case EventType.COLLECTION_REMOVED: {
      const [, collection, index] = wireEvent;
      if (typeof index !== "number") {
        console.warn("Ignoring COLLECTION_REMOVED event without sync index");
        return null;
      }
      return { type: EventType.COLLECTION_REMOVED, collection, index };
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

function isCommandResultPayload(payload: WireStreamPayload): boolean {
  return payload[0] === CommandResult.REFRESH || payload[0] === CommandResult.REFRESH_ALL;
}

function isLeaseResponsePayload(payload: WireStreamPayload): boolean {
  return isWireLeaseResponse(payload);
}
