import type { TypedContfuClient, TypedFlatContfuClient } from "./domain/query-types";
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
  resolveWithFunctions,
} from "./domain/filter-helpers";
import { findItems } from "./features/items/findItems";
import { db } from "./infra/db/db";
import { createHttpTypedClient } from "./infra/http/query-client";

export type ContfuConfig = { url?: string; apiKey?: string; flat?: boolean };

function normalizeArgs(
  first?: string | Record<string, any>,
  second?: any,
  third?: any,
): { options: Record<string, any>; config?: { flat?: boolean } } {
  if (typeof first === "string") {
    if (second == null) return { options: { collection: first } };
    if (typeof second === "string" || typeof second === "function")
      return { options: { collection: first, filter: second }, config: third };
    return { options: { collection: first, ...second }, config: third };
  }
  return { options: first ?? {}, config: second };
}

function resolveFilter(filter: unknown): string | undefined {
  if (typeof filter === "function") return filter(createItemRef(0));
  return filter as string | undefined;
}

function createLocalTypedClient<_CMap>(flatDefault: boolean, ctx = db): any {
  // eslint-disable-next-line typescript/require-await -- mirrors async remote API for seamless local/remote switching
  const callable = async (first?: any, second?: any, third?: any) => {
    const { options, config } = normalizeArgs(first, second, third);
    const { collection, ...rest } = options;
    const flat = config?.flat ?? flatDefault;
    const filter = resolveFilter(rest.filter);
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;
    if (collection) {
      const opts = {
        ...rest,
        flat,
        with: resolvedWith,
        filter: filter
          ? `collection = "${collection}" && (${filter})`
          : `collection = "${collection}"`,
      };
      return findItems(opts, ctx);
    }
    return findItems({ ...rest, flat, filter, with: resolvedWith }, ctx);
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

export function contfu<CMap>(config: ContfuConfig & { flat: true }): TypedFlatContfuClient<CMap>;
export function contfu<CMap>(config?: ContfuConfig): TypedContfuClient<CMap>;
export function contfu<CMap>(
  config?: ContfuConfig,
): TypedContfuClient<CMap> | TypedFlatContfuClient<CMap> {
  const flat = config?.flat ?? false;
  if (config?.url) {
    return createHttpTypedClient<CMap>(config.url, config.apiKey, flat);
  }
  return createLocalTypedClient<CMap>(flat);
}
