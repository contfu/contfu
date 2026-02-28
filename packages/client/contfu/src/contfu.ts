import type { QueryOptions, TypedContfuClient, TypedFlatContfuClient } from "./domain/query-types";
import { resolveWithFunctions } from "./domain/filter-helpers";
import { findItems } from "./features/items/findItems";
import { db } from "./infra/db/db";
import { createHttpTypedClient } from "./infra/http/query-client";

export type ContfuConfig = { url?: string; apiKey?: string; flat?: boolean };

function createLocalTypedClient<_CMap>(flatDefault: boolean, ctx = db): any {
  // eslint-disable-next-line typescript/require-await -- mirrors async remote API for seamless local/remote switching
  const callable = async (
    options: QueryOptions & { collection?: string; with?: any } = {},
    config?: { flat?: boolean },
  ) => {
    const { collection, ...rest } = options;
    const flat = config?.flat ?? flatDefault;
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;
    if (collection) {
      const opts = {
        ...rest,
        flat,
        with: resolvedWith,
        filter: rest.filter
          ? `collection = "${collection}" && (${rest.filter})`
          : `collection = "${collection}"`,
      };
      return findItems(opts, ctx);
    }
    return findItems({ ...rest, flat, with: resolvedWith }, ctx);
  };

  return callable;
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
