import {
  countCollections,
  countDownloadedFiles,
  countFiles,
  countItems,
  countProcessedFiles,
  findItems,
  generateTypes,
  getCollectionSchemaByName,
  getFilesByItem,
  getItemById,
  getTypeGenerationInputs,
  listCollections,
  queryItems,
  createRuntimeEventMonitor,
  type QueryItemsInput,
  type RuntimeNotification,
  type RuntimeStatus,
} from "@contfu/contfu";
import {
  generateApplicationIntegrationTypes,
  type IncludeOption,
  type QueryOptions,
  type WithClause,
} from "@contfu/core";
import { basicAuth, checkBasicAuth } from "./basic-auth";
import { events } from "./contfu";
import { handleFileRequest } from "./files";

// oxlint-disable-next-line typescript/no-redundant-type-constituents
type RouteRequest = Request & { params: Record<string, string> };

type LiveEvent =
  | { type: "ready"; ts: number }
  | { type: "sync-status"; state: RuntimeStatus["state"]; reason: string | null; ts: number }
  | Extract<RuntimeNotification, { type: "data-changed-batch" }>;

type QueryParseResult = { options: QueryOptions } | { error: string };
type RouteHandler = (request: RouteRequest) => Response | Promise<Response>;
export type ServerI18nOptions = {
  defaultLocale?: string;
  fallback?: string | true | false;
};

const HEARTBEAT_MS = 25_000;
const SERVER_IDLE_TIMEOUT_SECONDS = 60;
const encoder = new TextEncoder();
const runtimeEvents = createRuntimeEventMonitor(events);

function toLiveEvent(event: RuntimeNotification): LiveEvent {
  if (event.type === "runtime-status") {
    return { type: "sync-status", state: event.state, reason: event.reason, ts: event.ts };
  }

  return event;
}

function subscribe(subscriber: (event: LiveEvent) => void) {
  return runtimeEvents.subscribe((event) => subscriber(toLiveEvent(event)));
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

function parseIntegerParam(value: string, name: "limit" | "offset") {
  if (!/^-?\d+$/.test(value)) {
    return { error: `Invalid '${name}' parameter` };
  }

  return Number.parseInt(value, 10);
}

function deserializeQueryParams(params: URLSearchParams): QueryParseResult {
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
  if (limit !== null) {
    const parsed = parseIntegerParam(limit, "limit");
    if (typeof parsed === "object") {
      return parsed;
    }
    options.limit = parsed;
  }

  const offset = params.get("offset");
  if (offset !== null) {
    const parsed = parseIntegerParam(offset, "offset");
    if (typeof parsed === "object") {
      return parsed;
    }
    options.offset = parsed;
  }

  const include = params.get("include");
  if (include) options.include = include.split(",").map((s) => s.trim()) as IncludeOption[];

  const withStr = params.get("with");
  if (withStr !== null) {
    try {
      options.with = JSON.parse(withStr) as WithClause;
    } catch {
      return { error: "Invalid 'with' parameter" };
    }
  }

  const fields = params.get("fields");
  if (fields !== null) {
    options.fields = fields === "" ? [] : fields.split(",").map((s) => s.trim());
  }

  if (params.get("flat") === "true") options.flat = true;
  if (params.get("includeDeleted") === "true") options.includeDeleted = true;
  if (params.get("onlyDeleted") === "true") options.onlyDeleted = true;

  const locale = params.get("locale");
  if (locale !== null) options.locale = locale === "false" ? false : locale;

  const fallback = params.get("fallback");
  if (fallback !== null) {
    options.fallback = fallback === "false" ? false : fallback === "true" ? true : fallback;
  }

  return { options };
}

function parseOptionalIntegerParam(value: string | null): number | undefined {
  if (value === null || value === "") return undefined;
  if (!/^-?\d+$/.test(value)) return undefined;
  return Number.parseInt(value, 10);
}

function parseQueryItemsInput(params: URLSearchParams): QueryItemsInput {
  const propFiltersParam = params.get("propFilters");
  let propFilters: QueryItemsInput["propFilters"];

  if (propFiltersParam) {
    try {
      const parsed = JSON.parse(propFiltersParam);
      if (Array.isArray(parsed)) {
        propFilters = parsed;
      }
    } catch {
      // ignore invalid filters and fall back to undefined
    }
  }

  const sortField = params.get("sortField");
  const sortDirection = params.get("sortDirection");

  return {
    collection: params.get("collection") ?? undefined,
    changedAtFrom: parseOptionalIntegerParam(params.get("changedAtFrom")),
    changedAtTo: parseOptionalIntegerParam(params.get("changedAtTo")),
    propFilters,
    sortField: sortField === "changedAt" || sortField === "collection" ? sortField : undefined,
    sortDirection: sortDirection === "asc" || sortDirection === "desc" ? sortDirection : undefined,
    page: parseOptionalIntegerParam(params.get("page")),
    pageSize: parseOptionalIntegerParam(params.get("pageSize")),
    includeDeleted: params.get("includeDeleted") === "true" ? true : undefined,
    onlyDeleted: params.get("onlyDeleted") === "true" ? true : undefined,
  };
}

function handleCollections() {
  return json(listCollections());
}

function handleQueryItems(request: Request) {
  const url = new URL(request.url);
  return json(queryItems(parseQueryItemsInput(url.searchParams)));
}

function hasI18nConfig(i18n: ServerI18nOptions): boolean {
  return i18n.defaultLocale !== undefined || i18n.fallback !== undefined;
}

function findItemsWithServerI18n(options: QueryOptions, i18n: ServerI18nOptions) {
  if (!hasI18nConfig(i18n)) return findItems(options);
  return findItems(options, undefined, i18n);
}

function applyI18nDefaults(
  options: QueryOptions,
  params: URLSearchParams,
  i18n: ServerI18nOptions,
): QueryOptions {
  if (!params.has("locale") && i18n.defaultLocale !== undefined) {
    options.locale = i18n.defaultLocale;
  }
  if (!params.has("fallback") && i18n.fallback !== undefined) {
    if (i18n.fallback !== true || i18n.defaultLocale !== undefined) {
      options.fallback = i18n.fallback;
    }
  }
  return options;
}

function createItemsHandler(i18n: ServerI18nOptions) {
  return function handleItems(request: Request) {
    const url = new URL(request.url);
    const query = deserializeQueryParams(url.searchParams);
    if ("error" in query) {
      return text(query.error, 400);
    }
    return json(
      findItemsWithServerI18n(applyI18nDefaults(query.options, url.searchParams, i18n), i18n),
    );
  };
}

function createCollectionItemsHandler(i18n: ServerI18nOptions) {
  return function handleCollectionItems(request: RouteRequest) {
    const url = new URL(request.url);
    const name = decodeURIComponent(request.params.name);
    const query = deserializeQueryParams(url.searchParams);
    if ("error" in query) {
      return text(query.error, 400);
    }
    const options = applyI18nDefaults(query.options, url.searchParams, i18n);
    const collectionFilter = `$collection = ${JSON.stringify(name)}`;
    options.filter = options.filter
      ? `${collectionFilter} && (${options.filter})`
      : collectionFilter;
    return json(findItemsWithServerI18n(options, i18n));
  };
}

function handleItemFiles(request: RouteRequest) {
  const id = Number(decodeURIComponent(request.params.id));
  if (!Number.isInteger(id) || id <= 0) return text("Invalid item id", 400);
  return json(getFilesByItem(id));
}

function handleItemById(request: RouteRequest) {
  const url = new URL(request.url);
  const id = Number(decodeURIComponent(request.params.id));
  if (!Number.isInteger(id) || id <= 0) return text("Invalid item id", 400);
  const query = deserializeQueryParams(url.searchParams);
  if ("error" in query) {
    return text(query.error, 400);
  }
  const { include, with: withClause, includeDeleted, onlyDeleted } = query.options;
  const options: {
    include?: IncludeOption[];
    with?: WithClause;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
  } = {};

  if (include) {
    options.include = include;
  }

  if (withClause !== undefined) {
    options.with = withClause;
  }
  if (includeDeleted) options.includeDeleted = true;
  if (onlyDeleted) options.onlyDeleted = true;

  const item = getItemById(id, options);
  if (!item) {
    return text("Item not found", 404);
  }

  return json({ data: item });
}

function handleStatus() {
  return json({
    itemCount: countItems(),
    collectionCount: countCollections(),
    fileCount: countFiles(),
    downloadedCount: countDownloadedFiles(),
    processedCount: countProcessedFiles(),
    sync: runtimeEvents.getStatus(),
  });
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
        state: runtimeEvents.getStatus().state,
        reason: runtimeEvents.getStatus().reason,
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
      Integration: "keep-alive",
    },
  });
}

function handleCollectionDetail(request: RouteRequest) {
  const url = new URL(request.url);
  const name = decodeURIComponent(request.params.name);
  const collection = listCollections().find((entry) => entry.name === name) ?? null;
  const result = queryItems({
    ...parseQueryItemsInput(url.searchParams),
    collection: name,
  });
  const schema = getCollectionSchemaByName(name);
  const typeString = schema != null ? generateTypes({ [name]: schema }) : null;

  return json({ collection, result, typeString });
}

function handleTypes() {
  return text(generateApplicationIntegrationTypes(getTypeGenerationInputs()));
}

function withGetOnly(handler: RouteHandler): RouteHandler {
  return (request) => {
    if (request.method !== "GET") {
      return text("Method not allowed", 405);
    }

    return handler(request);
  };
}

function withOptionalBasicAuth(handler: RouteHandler): RouteHandler {
  return (request) => {
    const authError = checkBasicAuth(request, basicAuth);
    if (authError) {
      return authError;
    }

    return handler(request);
  };
}

function getRoute(handler: RouteHandler): RouteHandler {
  return withOptionalBasicAuth(withGetOnly(handler));
}

export type ServerOptions = {
  db?: string;
  port?: number;
  i18n?: ServerI18nOptions;
};

const defaultPort = 3001;

function parseEnvString(value: string | undefined): string | undefined {
  if (value === undefined || value === "") return undefined;
  return value;
}

function parseEnvFallback(value: string | undefined): string | true | false | undefined {
  const parsed = parseEnvString(value);
  if (parsed === undefined) return undefined;
  if (parsed === "true") return true;
  if (parsed === "false") return false;
  return parsed;
}

export function createServeOptions(opts: ServerOptions = {}) {
  const port = opts.port ?? defaultPort;
  const db = opts.db ?? process.env.CONTFU_DB ?? process.env.DATABASE_URL;
  const i18n: ServerI18nOptions = {
    defaultLocale: opts.i18n?.defaultLocale ?? parseEnvString(process.env.CONTFU_DEFAULT_LOCALE),
    fallback: opts.i18n?.fallback ?? parseEnvFallback(process.env.CONTFU_FALLBACK_LOCALE),
  };

  if (db) {
    process.env.CONTFU_DB = db;
    process.env.DATABASE_URL = db;
  }

  if (process.env.CONTFU_KEY) {
    runtimeEvents.start();
  }

  // Bun.serve routes (runtime-supported, types not yet in @types/bun@1.3.14)
  return {
    port,
    idleTimeout: SERVER_IDLE_TIMEOUT_SECONDS,
    routes: {
      "/api/status": getRoute(handleStatus),
      "/api/collections": getRoute(handleCollections),
      "/api/collections/:name": getRoute(handleCollectionDetail),
      "/api/query-items": getRoute(handleQueryItems),
      "/api/items": getRoute(createItemsHandler(i18n)),
      "/api/collections/:name/items": getRoute(createCollectionItemsHandler(i18n)),
      "/api/items/:id/files": getRoute(handleItemFiles),
      "/api/items/:id": getRoute(handleItemById),
      "/api/live": getRoute(handleLive),
      "/api/types": getRoute(handleTypes),
      "/files/:path": getRoute(handleFileRequest as RouteHandler),
    },
    fetch(request: Request) {
      const authError = checkBasicAuth(request, basicAuth);
      if (authError) {
        return authError;
      }

      if (request.method !== "GET") {
        return text("Method not allowed", 405);
      }

      return text("Not found", 404);
    },
  } as Parameters<typeof Bun.serve>[0];
}
