import type { Block } from "./blocks";
import { createItemRef } from "./filter-helpers";
import type { MarkdownOptions } from "./markdown";
import type { RenderOptions } from "./render";

export type ContentFormat = "object" | "markdown" | "html";

export type ResolvedContent<F extends ContentFormat | undefined> = F extends "markdown" | "html"
  ? string
  : Block[];

export type WithClause = {
  [relation: string]: {
    collection?: string;
    filter?: string;
    limit?: number;
    include?: IncludeOption[];
    single?: boolean;
    with?: WithClause;
  };
};

export type IncludeOption = "files" | "links" | "content";

export type SortOption = string | { field: string; direction: "asc" | "desc" };

export type QueryOptions = {
  filter?: string;
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  include?: IncludeOption[];
  fileMode?: "local" | "remote";
  with?: WithClause;
  fields?: string[];
  search?: string;
  /** Flatten nested object props into dot-separated result keys. */
  flat?: boolean;
  contentAs?: ContentFormat;
  htmlOptions?: RenderOptions;
  markdownOptions?: MarkdownOptions;
  /** Requested locale. `false` explicitly requests all locales and suppresses defaults. */
  locale?: string | false;
  /** Fallback locale override. `true` resolves to the configured default locale; `false` disables fallback. */
  fallback?: string | true | false;
};

export type QueryFilterFunction = (self: any) => string;

export type QueryWithEntry = Omit<WithClause[string], "filter" | "with"> & {
  filter?: string | QueryFilterFunction;
  with?: QueryWithInput;
};

export type QueryWithEntries = Record<string, QueryWithEntry>;

export type QueryWithInput = QueryWithEntries | ((parent: any) => QueryWithEntries);

export function resolveQueryFilter(filter: unknown, level = 0): string | undefined {
  if (typeof filter === "function") return (filter as QueryFilterFunction)(createItemRef(level));
  return filter as string | undefined;
}

export function resolveQueryWithFunctions(
  withVal: QueryWithInput | undefined,
  parentLevel = 1,
): WithClause | undefined {
  if (!withVal) return undefined;

  const entries = typeof withVal === "function" ? withVal(createItemRef(parentLevel)) : withVal;
  const result: WithClause = {};

  for (const [name, entry] of Object.entries(entries)) {
    result[name] = {
      collection: entry.collection,
      filter: resolveQueryFilter(entry.filter),
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: resolveQueryWithFunctions(entry.with, parentLevel + 1),
    };
  }

  return result;
}

export type QueryCallOptions = Omit<QueryOptions, "filter" | "with"> & {
  collection?: string;
  filter?: string | QueryFilterFunction;
  with?: QueryWithInput;
  [key: string]: unknown;
};

export function normalizeQueryArgs(
  first?: string | QueryCallOptions,
  second?: unknown,
): { options: QueryCallOptions } {
  if (typeof first === "string") {
    if (second == null) return { options: { collection: first } };
    if (typeof second === "string" || typeof second === "function") {
      return { options: { collection: first, filter: second as string | QueryFilterFunction } };
    }
    return { options: { collection: first, ...(second as QueryCallOptions) } };
  }
  return { options: first ?? {} };
}

export type QueryMeta = {
  total: number;
  limit: number;
  offset: number;
};

export class QueryResultArray<T> extends Array<T> {
  total: number;
  limit: number;
  offset: number;
  static get [Symbol.species]() {
    return Array;
  }
  constructor(items: T[], meta: QueryMeta) {
    super(...items);
    this.total = meta.total;
    this.limit = meta.limit;
    this.offset = meta.offset;
  }
  get meta(): QueryMeta {
    return { total: this.total, limit: this.limit, offset: this.offset };
  }
  toJSON() {
    return {
      data: Array.from(this),
      meta: this.meta,
    };
  }
}
