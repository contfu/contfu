import {
  all,
  and,
  contains,
  createItemRef,
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
import type { MediaOptimizer } from "./domain/media";
import { fileStore as defaultFileStore } from "./infra/media/media-defaults";
import type { TypedContfuClient } from "./domain/query-types";
import { resolveWithFunctions } from "./domain/filter-helpers";
import { findItems } from "./features/items/findItems";
import { connect } from "./features/stream/connect";
import { handleFileRequest as handleFileRequestImpl } from "./infra/http";
import { db } from "./infra/db/db";

export type ContfuOptions = {
  fileStore?: FileStore;
  mediaOptimizer?: MediaOptimizer;
  /** Authentication key. Falls back to process.env.CONTFU_KEY. */
  key?: string;
  /** Cache optimized file variants in the database. Default: true */
  cacheOptimizedFiles?: boolean;
};

export type SyncEvent = ItemEvent | StreamEvent;

export type ContfuInstance<CMap> = {
  query: TypedContfuClient<CMap>;
  fileStore: FileStore;
  events: AsyncIterable<SyncEvent>;
  handleFileRequest(request: Request, filePath: string): Promise<Response>;
};

export function contfu<CMap>(options: ContfuOptions = {}): ContfuInstance<CMap> {
  const fileStore = options.fileStore ?? defaultFileStore;
  const key = options.key ?? process.env.CONTFU_KEY;

  return {
    query: createLocalTypedClient(),
    fileStore,
    events: key ? createHotEventStream(key, fileStore) : emptyAsyncIterable(),
    handleFileRequest: (request, filePath) =>
      handleFileRequestImpl(request, filePath, { ...options, fileStore }),
  };
}

type Subscriber = {
  queue: SyncEvent[];
  resolve: (() => void) | null;
};

function createHotEventStream(key: string, fileStore: FileStore): AsyncIterable<SyncEvent> {
  const subscribers = new Set<Subscriber>();

  // Start consuming the connect() generator eagerly in the background
  void (async () => {
    for await (const event of connect({
      connectionEvents: true,
      reconnect: true,
      key: Buffer.from(key, "base64url"),
      fileStore,
    })) {
      for (const sub of subscribers) {
        sub.queue.push(event);
        sub.resolve?.();
        sub.resolve = null;
      }
    }
  })();

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
            sub.resolve = () => resolve({ value: sub.queue.shift()!, done: false });
          });
        },
        return() {
          subscribers.delete(sub);
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
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

function normalizeArgs(
  first?: string | Record<string, any>,
  second?: any,
): { options: Record<string, any> } {
  if (typeof first === "string") {
    if (second == null) return { options: { collection: first } };
    if (typeof second === "string" || typeof second === "function") {
      return { options: { collection: first, filter: second } };
    }
    return { options: { collection: first, ...second } };
  }
  return { options: first ?? {} };
}

function resolveFilter(filter: unknown): string | undefined {
  if (typeof filter === "function") return filter(createItemRef(0));
  return filter as string | undefined;
}

function createLocalTypedClient<_CMap>(ctx = db): any {
  // eslint-disable-next-line typescript/require-await -- mirrors async remote API for seamless local/remote switching
  const callable = async (first?: any, second?: any) => {
    const { options } = normalizeArgs(first, second);
    const { collection, ...rest } = options;
    const filter = resolveFilter(rest.filter);
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;

    if (collection) {
      const opts = {
        ...rest,
        with: resolvedWith,
        filter: filter
          ? `$collection = "${collection}" && (${filter})`
          : `$collection = "${collection}"`,
      };
      return findItems(opts, ctx);
    }

    return findItems({ ...rest, filter, with: resolvedWith }, ctx);
  };

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
  });
}
