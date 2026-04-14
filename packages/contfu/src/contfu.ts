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
import type { TypedContfuClient } from "./domain/query-types";
import { resolveWithFunctions } from "./domain/filter-helpers";
import { findItems } from "./features/items/findItems";
import { db } from "./infra/db/db";

export type ContfuConfig = Record<string, never>;

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

export function contfu<CMap>(_config?: ContfuConfig): TypedContfuClient<CMap> {
  return createLocalTypedClient();
}
