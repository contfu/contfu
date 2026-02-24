import type { AssetData, ItemData } from "../infra/types/content-types";

export type WithClause = {
  [relation: string]: {
    filter: string;
    limit?: number;
    include?: IncludeOption[];
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

export type ItemWithRelations = Omit<ItemData, "sourceType" | "ref"> & {
  sourceType?: ItemData["sourceType"];
  ref?: ItemData["ref"];
  assets?: AssetData[];
  relations?: Record<string, ItemWithRelations[]>;
};

export type QueryResult = {
  data: ItemWithRelations[];
  meta: QueryMeta;
};

export interface ContfuItemsClient {
  find(options?: QueryOptions): Promise<QueryResult>;
  get(
    id: string,
    options?: Pick<QueryOptions, "include" | "with">,
  ): Promise<ItemWithRelations | null>;
}

export interface ContfuCollectionClient {
  items: ContfuItemsClient;
}

export interface ContfuClient {
  items: ContfuItemsClient;
  collections(name: string): ContfuCollectionClient;
}
