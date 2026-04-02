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

export type IncludeOption = "assets" | "links" | "content";

export type SortOption = string | { field: string; direction: "asc" | "desc" };

export type QueryOptions = {
  filter?: string;
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  include?: IncludeOption[];
  with?: WithClause;
  fields?: string[];
  search?: string;
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
