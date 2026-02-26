import type { AssetData, ItemData } from "../infra/types/content-types";
import type { ItemRef } from "./filter-helpers";

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
  flat?: boolean;
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
  rels?: Record<string, ItemWithRelations[] | ItemWithRelations | null>;
};

export type QueryResult = {
  data: ItemWithRelations[];
  meta: QueryMeta;
};

// --- Flat query types ---

/** Core item fields present in flat output */
type CoreFlatFields = Omit<ItemWithRelations, "props" | "rels">;

/** Flat item: core fields + props + rels merged, rels win over props win over core */
export type FlatItem<Props, Rels = {}> = Omit<CoreFlatFields, keyof Props | keyof Rels> &
  Omit<Props, keyof Rels> &
  Rels;

export type FlatQueryResult<Props> = {
  data: FlatItem<Props>[];
  meta: QueryMeta;
};

export type FlatQueryResultWithRels<Props, Rels> = {
  data: FlatItem<Props, Rels>[];
  meta: QueryMeta;
};

// --- Typed query API ---

/** Pick specific fields from Props, or return all if F is undefined */
export type PickFields<Props, F> = F extends (keyof Props)[] ? Pick<Props, F[number]> : Props;

/** An item with typed props */
export type TypedItem<Props> = Omit<ItemWithRelations, "props"> & {
  props: Props;
};

/** Result of a typed query */
export type TypedQueryResult<Props> = {
  data: TypedItem<Props>[];
  meta: QueryMeta;
};

/** A single with-clause entry with typed filter callbacks */
export type TypedWithEntry<CMap, ChildC extends keyof CMap & string = keyof CMap & string> = {
  collection?: ChildC;
  filter?: string | ((self: ItemRef<CMap[ChildC]>) => string);
  limit?: number;
  include?: IncludeOption[];
  single?: boolean;
  with?: TypedWithInput<CMap, CMap[ChildC]>;
};

/** With input: object map or function returning object map */
export type TypedWithInput<CMap, ParentProps> =
  | { [rel: string]: TypedWithEntry<CMap, keyof CMap & string> }
  | ((parent: ItemRef<ParentProps>) => {
      [rel: string]: TypedWithEntry<CMap, keyof CMap & string>;
    });

/** Query entry shape for typed queries — used for both top-level and with entries */
export type TypedQueryEntry<
  CMap,
  C extends keyof CMap & string = keyof CMap & string,
  F extends (keyof CMap[C] & string)[] | undefined = undefined,
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

/** Normalize function-form → object-form at type level */
type ResolveWithShape<W> = W extends (...args: any[]) => infer R ? R : W;

/** Map a single with-entry to its result type */
type InferRelValue<CMap, Entry> = Entry extends { collection: infer C; single: true }
  ? C extends keyof CMap
    ? TypedItem<CMap[C]> | null
    : TypedItem<Record<string, unknown>> | null
  : Entry extends { collection: infer C }
    ? C extends keyof CMap
      ? TypedItem<CMap[C]>[]
      : TypedItem<Record<string, unknown>>[]
    : TypedItem<Record<string, unknown>>[];

/** Map every key in the with-shape to its inferred relation type */
export type InferRels<CMap, W> = {
  [K in keyof ResolveWithShape<W>]: InferRelValue<CMap, ResolveWithShape<W>[K]>;
};

/** Map a single with-entry to its flat result type */
type FlatInferRelValue<CMap, Entry> = Entry extends { collection: infer C; single: true }
  ? C extends keyof CMap
    ? FlatItem<CMap[C]> | null
    : FlatItem<Record<string, unknown>> | null
  : Entry extends { collection: infer C }
    ? C extends keyof CMap
      ? FlatItem<CMap[C]>[]
      : FlatItem<Record<string, unknown>>[]
    : FlatItem<Record<string, unknown>>[];

/** Map every key in the with-shape to its inferred flat relation type */
export type FlatInferRels<CMap, W> = {
  [K in keyof ResolveWithShape<W>]: FlatInferRelValue<CMap, ResolveWithShape<W>[K]>;
};

/** An item with rels guaranteed to be present */
export type TypedItemWithRels<
  Props,
  Rels = Record<string, ItemWithRelations[] | ItemWithRelations | null>,
> = Omit<TypedItem<Props>, "rels"> & {
  rels: Rels;
};

/** Result of a typed query where with was specified */
export type TypedQueryResultWithRels<
  Props,
  Rels = Record<string, ItemWithRelations[] | ItemWithRelations | null>,
> = {
  data: TypedItemWithRels<Props, Rels>[];
  meta: QueryMeta;
};

/** Per-query config for flat mode override */
export type QueryConfig<Fl extends boolean> = { flat?: Fl };

/** Select result type based on flat flag */
type SelectResult<Props, Fl extends boolean> = Fl extends true
  ? FlatQueryResult<Props>
  : TypedQueryResult<Props>;

/** Select result-with-rels type based on flat flag */
type SelectResultWithRels<Props, Rels, FlatRels, Fl extends boolean> = Fl extends true
  ? FlatQueryResultWithRels<Props, FlatRels>
  : TypedQueryResultWithRels<Props, Rels>;

/** Callable typed client interface (internal — use TypedContfuClient or TypedFlatContfuClient) */
interface TypedContfuClientBase<CMap, DefaultFlat extends boolean = false> {
  /** Typed with function-form `with` */
  <
    C extends keyof CMap & string,
    const F extends (keyof CMap[C] & string)[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap> } = {
      [rel: string]: TypedWithEntry<CMap>;
    },
    const Fl extends boolean = DefaultFlat,
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C; with: (parent: ItemRef<CMap[C]>) => W },
    config?: QueryConfig<Fl>,
  ): Promise<
    SelectResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, FlatInferRels<CMap, W>, Fl>
  >;

  /** Typed with object-form `with` */
  <
    C extends keyof CMap & string,
    const F extends (keyof CMap[C] & string)[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap> } = {
      [rel: string]: TypedWithEntry<CMap>;
    },
    const Fl extends boolean = DefaultFlat,
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C; with: W },
    config?: QueryConfig<Fl>,
  ): Promise<
    SelectResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, FlatInferRels<CMap, W>, Fl>
  >;

  /** Typed: collection specified → typed result */
  <
    C extends keyof CMap & string,
    const F extends (keyof CMap[C] & string)[] | undefined = undefined,
    const Fl extends boolean = DefaultFlat,
  >(
    options: TypedQueryEntry<CMap, C, F> & { collection: C },
    config?: QueryConfig<Fl>,
  ): Promise<SelectResult<PickFields<CMap[C], F>, Fl>>;

  /** Untyped: no collection → generic result */
  (options?: QueryOptions, config?: { flat?: boolean }): Promise<QueryResult>;
}

/** Typed client with nested (default) output */
export type TypedContfuClient<CMap> = TypedContfuClientBase<CMap, false>;

/** Typed client with flat (default) output */
export type TypedFlatContfuClient<CMap> = TypedContfuClientBase<CMap, true>;
