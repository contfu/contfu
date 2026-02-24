import type {
  ContfuClient,
  ContfuCollectionClient,
  ContfuItemsClient,
  IncludeOption,
  ItemWithRelations,
  QueryOptions,
  QueryResult,
  WithClause,
} from "../../domain/query-types";

export function createHttpClient(baseUrl: string, apiKey?: string): ContfuClient {
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
    return res.json();
  }

  function buildQueryParams(options: QueryOptions = {}): URLSearchParams {
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

    return params;
  }

  function createItemsClient(collectionFilter?: string): ContfuItemsClient {
    const basePath = collectionFilter
      ? `${baseUrl}/api/collections/${encodeURIComponent(collectionFilter)}/items`
      : `${baseUrl}/api/items`;

    return {
      async find(options: QueryOptions = {}): Promise<QueryResult> {
        const params = buildQueryParams(options);
        const url = `${basePath}?${params}`;
        return fetchJson<QueryResult>(url);
      },

      async get(
        id: string,
        options?: Pick<QueryOptions, "include" | "with">,
      ): Promise<ItemWithRelations | null> {
        const params = new URLSearchParams();
        if (options?.include?.length) params.set("include", options.include.join(","));
        if (options?.with) params.set("with", JSON.stringify(options.with));

        const qs = params.toString();
        const url = `${baseUrl}/api/items/${encodeURIComponent(id)}${qs ? `?${qs}` : ""}`;
        try {
          const result = await fetchJson<{ data: ItemWithRelations }>(url);
          return result.data;
        } catch {
          return null;
        }
      },
    };
  }

  return {
    items: createItemsClient(),
    collections(name: string): ContfuCollectionClient {
      return {
        items: createItemsClient(name),
      };
    },
  };
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

  return options;
}
