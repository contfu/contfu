import { EventType } from "@contfu/core";
import type { IncludeOption, QueryOptions, WithClause } from "@contfu/core";

type RouteRequest = Request & { params: Record<string, string> };

type SyncConnectionState = "disabled" | "connecting" | "syncing" | "connected" | "error";

type SyncStatus = {
  state: SyncConnectionState;
  reason: string | null;
};

type LiveDataChangedKind = "item" | "schema" | "unknown";

type LiveEvent =
  | { type: "ready"; ts: number }
  | { type: "sync-status"; state: SyncConnectionState; reason: string | null; ts: number }
  | {
      type: "data-changed-batch";
      count: number;
      kinds: LiveDataChangedKind[];
      windowMs: number;
      ts: number;
    };

const DATA_CHANGED_WINDOW_MS = 250;
const HEARTBEAT_MS = 25_000;
const encoder = new TextEncoder();

let syncStarted = false;
let syncStatus: SyncStatus = { state: "disabled", reason: null };
let bufferedCount = 0;
let bufferedKinds = new Set<LiveDataChangedKind>();
let bufferTimer: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<(event: LiveEvent) => void>();

async function getContfu() {
  return import("@contfu/contfu");
}

function setSyncStatus(next: SyncStatus) {
  syncStatus = next;
}

function publish(event: LiveEvent) {
  for (const subscriber of subscribers) {
    try {
      subscriber(event);
    } catch {
      // Keep one broken subscriber from affecting the rest.
    }
  }
}

function publishSyncStatus(status: SyncStatus) {
  publish({
    type: "sync-status",
    state: status.state,
    reason: status.reason,
    ts: Date.now(),
  });
}

function clearBufferTimer() {
  if (bufferTimer !== null) {
    clearTimeout(bufferTimer);
    bufferTimer = null;
  }
}

function flushDataChangedBatch() {
  if (bufferedCount === 0) {
    clearBufferTimer();
    return;
  }

  publish({
    type: "data-changed-batch",
    count: bufferedCount,
    kinds: [...bufferedKinds],
    windowMs: DATA_CHANGED_WINDOW_MS,
    ts: Date.now(),
  });

  bufferedCount = 0;
  bufferedKinds = new Set<LiveDataChangedKind>();
  clearBufferTimer();
}

function bufferDataChanged(kind: LiveDataChangedKind) {
  bufferedCount += 1;
  bufferedKinds.add(kind);

  if (bufferTimer !== null) {
    return;
  }

  bufferTimer = setTimeout(() => {
    flushDataChangedBatch();
  }, DATA_CHANGED_WINDOW_MS);
}

function subscribe(subscriber: (event: LiveEvent) => void) {
  subscribers.add(subscriber);
  return () => {
    subscribers.delete(subscriber);
  };
}

function serializeSseEvent(event: LiveEvent | { type: "ping"; ts: number }) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

function deserializeQueryParams(params: URLSearchParams): QueryOptions {
  const options: QueryOptions = {};

  const filter = params.get("filter");
  if (filter) options.filter = filter;

  const search = params.get("search");
  if (search) options.search = search;

  const sort = params.get("sort");
  if (sort) {
    options.sort = sort.split(",").map((s) => s.trim());
  }

  const limit = params.get("limit");
  if (limit) options.limit = parseInt(limit, 10);

  const offset = params.get("offset");
  if (offset) options.offset = parseInt(offset, 10);

  const include = params.get("include");
  if (include) options.include = include.split(",").map((s) => s.trim()) as IncludeOption[];

  const withStr = params.get("with");
  if (withStr) {
    try {
      options.with = JSON.parse(withStr) as WithClause;
    } catch {
      // ignore invalid JSON
    }
  }

  const fields = params.get("fields");
  if (fields !== null) {
    options.fields = fields === "" ? [] : fields.split(",").map((s) => s.trim());
  }

  return options;
}

async function handleItems(request: Request) {
  const url = new URL(request.url);
  const { findItems } = await getContfu();
  const options = deserializeQueryParams(url.searchParams);
  return json(findItems(options));
}

async function handleCollectionItems(request: RouteRequest) {
  const url = new URL(request.url);
  const name = decodeURIComponent(request.params.name);
  const { findItems } = await getContfu();
  const options = deserializeQueryParams(url.searchParams);
  const collectionFilter = `$collection = ${JSON.stringify(name)}`;
  options.filter = options.filter ? `${collectionFilter} && (${options.filter})` : collectionFilter;
  return json(findItems(options));
}

async function handleItemById(request: RouteRequest) {
  const url = new URL(request.url);
  const id = decodeURIComponent(request.params.id);
  const { getItemById } = await getContfu();
  const include = url.searchParams.get("include");
  const withStr = url.searchParams.get("with");
  const options: { include?: IncludeOption[]; with?: WithClause } = {};

  if (include) {
    options.include = include.split(",").map((value) => value.trim()) as IncludeOption[];
  }

  if (withStr) {
    try {
      options.with = JSON.parse(withStr);
    } catch {
      return text("Invalid 'with' parameter", 400);
    }
  }

  const item = getItemById(id, options);
  if (!item) {
    return text("Item not found", 404);
  }

  return json({ data: item });
}

function handleLive() {
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const send = (event: LiveEvent | { type: "ping"; ts: number }) => {
        if (closed) {
          return;
        }

        try {
          controller.enqueue(encoder.encode(serializeSseEvent(event)));
        } catch {
          close();
        }
      };

      const close = () => {
        if (closed) {
          return;
        }

        closed = true;
        if (heartbeat !== null) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }

        try {
          controller.close();
        } catch {
          // Ignore double-close races from disconnect/cancel.
        }
      };

      cleanup = close;
      unsubscribe = subscribe((event) => {
        send(event);
      });

      send({ type: "ready", ts: Date.now() });
      send({
        type: "sync-status",
        state: syncStatus.state,
        reason: syncStatus.reason,
        ts: Date.now(),
      });

      heartbeat = setInterval(() => {
        send({ type: "ping", ts: Date.now() });
      }, HEARTBEAT_MS);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function handleTypes() {
  const { generateTypes, getAllCollectionSchemas } = await getContfu();
  return text(generateTypes(getAllCollectionSchemas()));
}

async function startSync(key?: string) {
  if (syncStarted) {
    return;
  }
  syncStarted = true;

  if (!key) {
    setSyncStatus({ state: "disabled", reason: "Missing CONTFU_KEY" });
    return;
  }

  console.log("[contfu] connecting to sync service...");
  const connecting = { state: "connecting", reason: null } as const;
  setSyncStatus(connecting);
  publishSyncStatus(connecting);

  const { connect } = await getContfu();

  try {
    for await (const event of connect({
      connectionEvents: true,
      reconnect: true,
      key: Buffer.from(key, "base64url"),
    })) {
      if (event.type === EventType.STREAM_CONNECTED) {
        console.log("[contfu] stream connected");
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_START) {
        console.log("[contfu] snapshot sync started");
        const next = { state: "syncing", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_END) {
        console.log("[contfu] snapshot sync complete");
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.STREAM_DISCONNECTED) {
        console.error("[contfu] stream disconnected:", event.reason);
        const next = {
          state: "error",
          reason: event.reason ?? "Disconnected from sync service",
        } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.COLLECTION_SCHEMA) {
        bufferDataChanged("schema");
      } else if (event.type === EventType.ITEM_CHANGED || event.type === EventType.ITEM_DELETED) {
        bufferDataChanged("item");
      } else {
        bufferDataChanged("unknown");
      }
    }
  } catch (error) {
    console.error("[contfu] sync error:", error);
    const next = {
      state: "error",
      reason: error instanceof Error ? error.message : "Unknown sync error",
    } as const;
    setSyncStatus(next);
    publishSyncStatus(next);
  }
}

export type ServerOptions = {
  db?: string;
  key?: string;
  port?: number;
};

const defaultPort = 3001;

export function createServeOptions(opts: ServerOptions = {}) {
  const port = opts.port ?? defaultPort;
  const key = opts.key ?? process.env.CONTFU_KEY;
  const db = opts.db ?? process.env.CONTFU_DB ?? process.env.DATABASE_URL;

  if (db) {
    process.env.CONTFU_DB = db;
    process.env.DATABASE_URL = db;
  }

  void startSync(key);

  // Bun.serve routes (runtime-supported, types not yet in @types/bun@1.3.11)
  return {
    port,
    routes: {
      "/api/items": handleItems,
      "/api/collections/:name/items": handleCollectionItems,
      "/api/items/:id": handleItemById,
      "/api/live": handleLive,
      "/api/types": handleTypes,
    },
    fetch(request: Request) {
      if (request.method !== "GET") {
        return text("Method not allowed", 405);
      }
      return text("Not found", 404);
    },
  } as Parameters<typeof Bun.serve>[0];
}
