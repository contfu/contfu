import type { AssetData, ItemData } from "../infra/types/content-types";
import type {
  and,
  contains,
  eq,
  gt,
  gte,
  ItemRef,
  like,
  linkedFrom,
  linksTo,
  lt,
  lte,
  ne,
  notLike,
  or,
} from "./filter-helpers";
import type { SystemFieldName } from "./system-fields";

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

export type QuerySystemFields = {
  $id: string;
  $connectionType?: ItemData["connectionType"];
  $ref: ItemData["ref"];
  $collection: string;
  $changedAt: number;
};

type ItemExtras = {
  assets?: AssetData[];
  links: ItemData["links"];
  content?: ItemData["content"];
};

export type ItemWithRelations<Props = {}, Rels = {}> = QuerySystemFields &
  ItemExtras &
  Props &
  Rels &
  Record<string, unknown>;

export type QueryResult = QueryResultArray<ItemWithRelations<Record<string, unknown>>>;

export type SelectableField<Props> = SystemFieldName | (keyof Props & string);

type SelectableShape<Props> = QuerySystemFields & Props;

export type PickFields<Props, F> = F extends readonly SelectableField<Props>[]
  ? Pick<SelectableShape<Props>, Extract<F[number], keyof SelectableShape<Props>>>
  : SelectableShape<Props>;

export type TypedItem<Props> = ItemWithRelations<Props>;

export type TypedQueryResult<Props> = QueryResultArray<TypedItem<Props>>;

export type TypedWithEntry<CMap, ChildC extends keyof CMap & string = keyof CMap & string> = {
  collection?: ChildC;
  filter?: string | ((self: any) => string);
  limit?: number;
  include?: IncludeOption[];
  single?: boolean;
  with?: TypedWithInput<CMap, CMap[ChildC]>;
};

export type TypedWithInput<CMap, ParentProps> =
  | { [rel: string]: TypedWithEntry<CMap, any> }
  | ((parent: ItemRef<ParentProps>) => {
      [rel: string]: TypedWithEntry<CMap, any>;
    });

export type TypedQueryEntry<
  CMap,
  C extends keyof CMap & string = keyof CMap & string,
  F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
> = {
  collection?: C;
  filter?: string;
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  search?: string;
  include?: IncludeOption[];
  fields?: F;
  with?: TypedWithInput<CMap, CMap[C]>;
};

type ResolveWithShape<W> = W extends (...args: any[]) => infer R ? R : W;

type InferRelValue<CMap, Entry> = Entry extends { collection: infer C; single: true }
  ? C extends keyof CMap
    ? TypedItem<CMap[C]> | null
    : TypedItem<Record<string, unknown>> | null
  : Entry extends { collection: infer C }
    ? C extends keyof CMap
      ? TypedItem<CMap[C]>[]
      : TypedItem<Record<string, unknown>>[]
    : TypedItem<Record<string, unknown>>[];

export type InferRels<CMap, W> = {
  [K in keyof ResolveWithShape<W>]: InferRelValue<CMap, ResolveWithShape<W>[K]>;
};

export type TypedQueryResultWithRels<Props, Rels = Record<string, unknown>> = QueryResultArray<
  ItemWithRelations<Props, Rels>
>;

export type EntryOpts<CMap, C extends keyof CMap & string> = {
  filter?: string | ((self: ItemRef<CMap[C]>) => string);
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  search?: string;
  include?: IncludeOption[];
  fields?: SelectableField<CMap[C]>[];
  with?: TypedWithInput<CMap, CMap[C]>;
};

export interface TypedAllFn<CMap> {
  <C extends keyof CMap & string>(collection: C): { collection: C };
  <C extends keyof CMap & string>(collection: C, filter: string): { collection: C; filter: string };
  <C extends keyof CMap & string>(
    collection: C,
    filter: (self: ItemRef<CMap[C]>) => string,
  ): { collection: C; filter: (self: ItemRef<CMap[C]>) => string };
  <C extends keyof CMap & string, const O extends EntryOpts<CMap, C>>(
    collection: C,
    opts: O,
  ): O & { collection: C };
}

export interface TypedOneOfFn<CMap> {
  <C extends keyof CMap & string>(collection: C): { collection: C; single: true };
  <C extends keyof CMap & string>(
    collection: C,
    filter: string,
  ): { collection: C; single: true; filter: string };
  <C extends keyof CMap & string>(
    collection: C,
    filter: (self: ItemRef<CMap[C]>) => string,
  ): { collection: C; single: true; filter: (self: ItemRef<CMap[C]>) => string };
  <C extends keyof CMap & string, const O extends EntryOpts<CMap, C>>(
    collection: C,
    opts: O,
  ): O & { collection: C; single: true };
}

interface TypedContfuClientBase<CMap> {
  all: TypedAllFn<CMap>;
  oneOf: TypedOneOfFn<CMap>;
  eq: typeof eq;
  ne: typeof ne;
  gt: typeof gt;
  gte: typeof gte;
  lt: typeof lt;
  lte: typeof lte;
  like: typeof like;
  notLike: typeof notLike;
  contains: typeof contains;
  and: typeof and;
  or: typeof or;
  linksTo: typeof linksTo;
  linkedFrom: typeof linkedFrom;

  <C extends keyof CMap & string>(
    collection: C,
    filter: string,
  ): Promise<TypedQueryResult<CMap[C]>>;

  <C extends keyof CMap & string>(
    collection: C,
    filter: (self: ItemRef<CMap[C]>) => string,
  ): Promise<TypedQueryResult<CMap[C]>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
  >(
    collection: C,
    opts: Omit<EntryOpts<CMap, C>, "with" | "fields"> & {
      fields?: F;
      with: (parent: ItemRef<CMap[C]>) => W;
    },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
  >(
    collection: C,
    opts: Omit<EntryOpts<CMap, C>, "with" | "fields"> & { fields?: F; with: W },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
  >(
    collection: C,
    opts?: Omit<EntryOpts<CMap, C>, "fields"> & { fields?: F },
  ): Promise<TypedQueryResult<PickFields<CMap[C], F>>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C; with: (parent: ItemRef<CMap[C]>) => W },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C; with: W },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C },
  ): Promise<TypedQueryResult<PickFields<CMap[C], F>>>;

  (options?: QueryOptions): Promise<QueryResult>;
}

export type TypedContfuClient<CMap> = TypedContfuClientBase<CMap>;
