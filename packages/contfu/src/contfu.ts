import {
  CommandResult,
  EventType,
  normalizeQueryArgs,
  resolveQueryFilter,
  resolveQueryWithFunctions,
  all,
  and,
  contains,
  eq,
  gt,
  gte,
  like,
  linkedFrom,
  linksTo,
  lt,
  lte,
  ne,
  notLike,
  oneOf,
  or,
} from "@contfu/core";
import type { ItemEvent, StreamEvent } from "@contfu/connect";
import type { FileStore } from "./domain/files";
import type { ClientI18nConfig, LocaleScope } from "./domain/i18n";
import type {
  MediaMasterConfig,
  MediaOptimizer,
  MediaVariants,
  TransformMediaRule,
} from "./domain/media";
import type { QueryLocale, TypedContfuClient } from "./domain/query-types";
import { findItems } from "./features/items/findItems";
import { connect } from "./connect";
import { db } from "./infra/db/db";
import { handleFileRequest as handleFileRequestImpl } from "./infra/http";
import { fileStore as defaultFileStore } from "./infra/media/media-defaults";

export type ContfuOptions<CMap = unknown> = {
  fileStore?: FileStore;
  mediaOptimizer?: MediaOptimizer;
  /** Sync-time media conversion rules (format constraints, include/exclude filters). */
  transformMedia?: TransformMediaRule<CMap>[];
  /** Named variant presets for on-demand serving and optional sync-time pre-generation. */
  mediaVariants?: MediaVariants<CMap>;
  /** Canonical local masters for reprocessing without redownloading. Default: enabled. */
  mediaMaster?: false | MediaMasterConfig;
  /** Authentication key. Falls back to process.env.CONTFU_KEY. */
  key?: string;
  /** Cache optimized file variants in the database. Default: true */
  cacheOptimizedFiles?: boolean;
  /** Localize remote files into Contfu storage. Default: true */
  localFiles?: boolean;
  /** Base path used when resolving internal file metadata URLs. Default: /files */
  filesBasePath?: string;
  /** Number of concurrent media download/processing jobs. Default: 2 */
  mediaQueueConcurrency?: number;
  /** Optional app-level i18n overrides. DB config remains the source of truth. */
  i18n?: ClientI18nConfig<QueryLocale<CMap>>;
};

export type SyncEvent = ItemEvent | StreamEvent;

export type ContfuInstance<CMap> = {
  query: TypedContfuClient<CMap>;
  fileStore: FileStore;
  events: AsyncIterable<SyncEvent>;
  handleFileRequest(request: Request, filePath: string): Promise<Response>;
};

export function contfu<CMap = unknown>(options: ContfuOptions<CMap> = {}): ContfuInstance<CMap> {
  const fileStore = options.fileStore ?? defaultFileStore;
  const key = options.key ?? process.env.CONTFU_KEY;

  return {
    query: createLocalTypedClient(db, options.i18n, {}, options.filesBasePath),
    fileStore,
    events: key ? createHotEventStream(key, fileStore, options) : emptyAsyncIterable(),
    handleFileRequest: (request, filePath) =>
      handleFileRequestImpl<CMap>(request, filePath, { ...options, fileStore }),
  };
}

type Subscriber = {
  queue: SyncEvent[];
  resolve: ((result: IteratorResult<SyncEvent>) => void) | null;
};

const HOT_STREAM_INITIAL_RESTART_DELAY_MS = 1_000;
const HOT_STREAM_MAX_RESTART_DELAY_MS = 30_000;

function createHotEventStream<CMap>(
  key: string,
  fileStore: FileStore,
  options: ContfuOptions<CMap>,
): AsyncIterable<SyncEvent> {
  const subscribers = new Set<Subscriber>();

  const publish = (event: SyncEvent) => {
    for (const sub of subscribers) {
      sub.queue.push(event);
      sub.resolve?.({ value: sub.queue.shift()!, done: false });
      sub.resolve = null;
    }
  };

  void (async () => {
    let restartDelay = HOT_STREAM_INITIAL_RESTART_DELAY_MS;

    while (true) {
      try {
        for await (const event of connect({
          connectionEvents: true,
          reconnect: true,
          key: Buffer.from(key, "base64url"),
          fileStore,
          mediaOptimizer: options.mediaOptimizer,
          transformMedia: options.transformMedia,
          mediaVariants: options.mediaVariants,
          mediaMaster: options.mediaMaster,
          localFiles: options.localFiles ?? true,
          mediaQueueConcurrency: options.mediaQueueConcurrency ?? 2,
          commandResults: false,
        })) {
          if (event.type === CommandResult.REFRESH || event.type === CommandResult.REFRESH_ALL) {
            continue;
          }
          if (event.type === EventType.STREAM_CONNECTED) {
            restartDelay = HOT_STREAM_INITIAL_RESTART_DELAY_MS;
          }
          publish(event);
        }

        publish({
          type: EventType.STREAM_DISCONNECTED,
          reason: "Sync stream ended unexpectedly",
        });
      } catch (error) {
        publish({
          type: EventType.STREAM_DISCONNECTED,
          reason: error instanceof Error ? error.message : "Unknown sync stream error",
        });
      }

      await sleep(restartDelay);
      restartDelay = Math.min(restartDelay * 2, HOT_STREAM_MAX_RESTART_DELAY_MS);
    }
  })().catch((error) => {
    publish({
      type: EventType.STREAM_DISCONNECTED,
      reason: error instanceof Error ? error.message : "Unknown sync stream error",
    });
  });

  return {
    [Symbol.asyncIterator](): AsyncIterator<SyncEvent> {
      const sub: Subscriber = { queue: [], resolve: null };
      subscribers.add(sub);

      return {
        next() {
          if (sub.queue.length > 0) {
            return Promise.resolve({ value: sub.queue.shift()!, done: false });
          }
          return new Promise<IteratorResult<SyncEvent>>((resolve) => {
            sub.resolve = resolve;
          });
        },
        return() {
          subscribers.delete(sub);
          sub.resolve?.({ value: undefined, done: true });
          sub.resolve = null;
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyAsyncIterable(): AsyncIterable<SyncEvent> {
  return {
    [Symbol.asyncIterator]() {
      return {
        next: () => new Promise<IteratorResult<SyncEvent>>(() => {}),
        return: () => Promise.resolve({ value: undefined, done: true }),
      };
    },
  };
}

function createLocalTypedClient<_CMap>(
  ctx = db,
  appI18n?: ClientI18nConfig<QueryLocale<_CMap>>,
  scope: LocaleScope<QueryLocale<_CMap>> = {},
  filesBasePath?: string,
): any {
  // eslint-disable-next-line typescript-eslint/require-await -- mirrors async remote API for seamless local/remote switching
  const callable = async (first?: any, second?: any) => {
    const { options } = normalizeQueryArgs(first, second);
    const { collection, locale, fallback, ...rest } = options;
    const filter = resolveQueryFilter(rest.filter);
    const resolvedWith = resolveQueryWithFunctions(rest.with as any);

    if (collection) {
      const opts = {
        ...rest,
        locale,
        fallback,
        with: resolvedWith,
        filesBasePath,
        filter: filter
          ? `$collection = "${collection}" && (${filter})`
          : `$collection = "${collection}"`,
      };
      return findItems(opts, ctx, appI18n, scope);
    }

    return findItems(
      { ...rest, locale, fallback, filter, with: resolvedWith, filesBasePath },
      ctx,
      appI18n,
      scope,
    );
  };

  const withLocale = (
    locale: QueryLocale<_CMap> | false,
    fallback?: QueryLocale<_CMap> | true | false,
  ) => createLocalTypedClient(ctx, appI18n, { locale, fallback }, filesBasePath);

  return Object.assign(callable, {
    all,
    oneOf,
    eq,
    ne,
    gt,
    gte,
    lt,
    lte,
    like,
    notLike,
    contains,
    and,
    or,
    linksTo,
    linkedFrom,
    withLocale,
  });
}
