import { QueryResultArray } from "@contfu/core";
import type { QueryMeta, QueryOptions, WithClause } from "@contfu/core";
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

export function createHttpTypedClient<_CMap>(baseUrl: string, apiKey?: string): any {
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

  const callable = async (first?: any, second?: any) => {
    const { options } = normalizeArgs(first, second);
    const { collection, ...rest } = options;
    const filter = resolveFilter(rest.filter);
    const resolvedWith =
      rest.with && typeof rest.with === "function" ? resolveWithFunctions(rest.with, 1) : rest.with;
    const params = serializeQueryParams({ ...rest, filter, with: resolvedWith });

    if (collection) {
      const basePath = `${baseUrl}/api/collections/${encodeURIComponent(collection)}/items`;
      const url = `${basePath}?${params.toString()}`;
      const json = await fetchJson<{ data: any[]; meta: QueryMeta }>(url);
      return new QueryResultArray(json.data, json.meta);
    }

    const url = `${baseUrl}/api/items?${params.toString()}`;
    const json = await fetchJson<{ data: any[]; meta: QueryMeta }>(url);
    return new QueryResultArray(json.data, json.meta);
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

function resolveWithFunctions(withVal: any, parentLevel: number): WithClause {
  let entries: Record<string, any>;
  if (typeof withVal === "function") {
    entries = withVal(createItemRef(parentLevel));
  } else {
    entries = withVal;
  }

  const result: WithClause = {};
  for (const [name, entry] of Object.entries(entries)) {
    let filter: string | undefined;
    if (typeof entry.filter === "function") {
      filter = entry.filter(createItemRef(0));
    } else {
      filter = entry.filter;
    }
    result[name] = {
      collection: entry.collection,
      filter,
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: entry.with ? resolveWithFunctions(entry.with, parentLevel + 1) : undefined,
    };
  }
  return result;
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
  if (options.fields !== undefined) params.set("fields", options.fields.join(","));

  return params;
}
