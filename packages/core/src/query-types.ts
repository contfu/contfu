import type { Block } from "./blocks";
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
  contentAs?: ContentFormat;
  htmlOptions?: RenderOptions;
  markdownOptions?: MarkdownOptions;
  /** Requested locale. `false` explicitly requests all locales and suppresses defaults. */
  locale?: string | false;
  /** Fallback locale override. `true` resolves to the configured default locale; `false` disables fallback. */
  fallback?: string | true | false;
};

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
  toJSON() {
    return {
      data: Array.from(this),
      meta: { total: this.total, limit: this.limit, offset: this.offset },
    };
  }
}
