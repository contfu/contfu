import type {
  IncludeOption,
  QueryOptions,
  QueryResult,
  WithClause,
} from "../../domain/query-types";
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
} from "../../domain/filter-helpers";

export function createHttpTypedClient<_CMap>(
  baseUrl: string,
  apiKey?: string,
  flatDefault = false,
): any {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  async function fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

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

  const callable = async (first?: any, second?: any, third?: any) => {
    const { options, config } = normalizeArgs(first, second, third);
    const { collection, ...rest } = options;
    const flat = config?.flat ?? flatDefault;
    const filter = resolveFilter(rest.filter);
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;
    const params = serializeQueryParams({ ...rest, flat, filter, with: resolvedWith });
    if (collection) {
      const basePath = `${baseUrl}/api/collections/${encodeURIComponent(collection)}/items`;
      const url = `${basePath}?${params}`;
      return fetchJson<QueryResult>(url);
    }
    const url = `${baseUrl}/api/items?${params}`;
    return fetchJson<QueryResult>(url);
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

export function serializeQueryParams(options: QueryOptions): URLSearchParams {
  const params = new URLSearchParams();

  if (options.filter) params.set("filter", options.filter);
  if (options.search) params.set("search", options.search);

  if (options.sort) {
    const sorts = Array.isArray(options.sort) ? options.sort : [options.sort];
    const sortStr = sorts
      .map((s) => {
        if (typeof s === "string") return s;
        return s.direction === "desc" ? `-${s.field}` : s.field;
      })
      .join(",");
    params.set("sort", sortStr);
  }

  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.offset !== undefined) params.set("offset", String(options.offset));
  if (options.include?.length) params.set("include", options.include.join(","));
  if (options.with) params.set("with", JSON.stringify(options.with));
  if (options.fields?.length) params.set("fields", options.fields.join(","));
  if (options.flat) params.set("flat", "true");

  return params;
}

export function deserializeQueryParams(params: URLSearchParams): QueryOptions {
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
  if (fields) options.fields = fields.split(",").map((s) => s.trim());

  const flat = params.get("flat");
  if (flat === "true") options.flat = true;

  return options;
}
