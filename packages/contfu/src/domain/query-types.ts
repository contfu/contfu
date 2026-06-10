import {
  QueryResultArray,
  type ContentFormat,
  type IncludeOption,
  type MarkdownOptions,
  type QueryOptions,
  type RenderOptions,
  type ResolvedContent,
  type SortOption,
} from "@contfu/core";
import type { FileData, ItemData } from "../infra/types/content-types";
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
} from "@contfu/core";
import type { SystemFieldName } from "@contfu/core";

export type QuerySystemFields = {
  $id: number;
  $collection: string;
  $changedAt: number;
  $locale?: string;
};

type CollectionLocale<Props> = Props extends { $locale?: infer L }
  ? Extract<L, string>
  : Props extends { $locale: infer L }
    ? Extract<L, string>
    : never;

export type QueryLocale<CMap> = [CollectionLocale<CMap[keyof CMap & string]>] extends [never]
  ? string
  : CollectionLocale<CMap[keyof CMap & string]>;

type ItemExtras<CF extends ContentFormat = "object"> = {
  files?: FileData[];
  links: ItemData["links"];
  content?: ResolvedContent<CF>;
};

export type ItemWithRelations<
  Props = {},
  Rels = {},
  CF extends ContentFormat = "object",
> = QuerySystemFields & ItemExtras<CF> & Props & Rels & Record<string, unknown>;

export type QueryResult = QueryResultArray<ItemWithRelations<Record<string, unknown>>>;

export type SelectableField<Props> = SystemFieldName | (keyof Props & string);

type SelectableShape<Props> = QuerySystemFields & Props;

export type PickFields<Props, F> = F extends readonly SelectableField<Props>[]
  ? Pick<SelectableShape<Props>, Extract<F[number], keyof SelectableShape<Props>>>
  : SelectableShape<Props>;

export type TypedItem<Props, CF extends ContentFormat = "object"> = ItemWithRelations<
  Props,
  {},
  CF
>;

export type TypedQueryResult<Props, CF extends ContentFormat = "object"> = QueryResultArray<
  TypedItem<Props, CF>
>;

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

export type FileMode = "local" | "remote";

export type TypedQueryEntry<
  CMap,
  C extends keyof CMap & string = keyof CMap & string,
  F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
  CF extends ContentFormat = "object",
> = {
  collection?: C;
  filter?: string;
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  search?: string;
  include?: IncludeOption[];
  fileMode?: FileMode;
  fields?: F;
  with?: TypedWithInput<CMap, CMap[C]>;
  contentAs?: CF;
  htmlOptions?: RenderOptions;
  markdownOptions?: MarkdownOptions;
  locale?: QueryLocale<CMap>;
  fallback?: QueryLocale<CMap> | false;
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

export type TypedQueryResultWithRels<
  Props,
  Rels = Record<string, unknown>,
  CF extends ContentFormat = "object",
> = QueryResultArray<ItemWithRelations<Props, Rels, CF>>;

export type EntryOpts<CMap, C extends keyof CMap & string, CF extends ContentFormat = "object"> = {
  filter?: string | ((self: ItemRef<CMap[C]>) => string);
  sort?: SortOption | SortOption[];
  limit?: number;
  offset?: number;
  search?: string;
  include?: IncludeOption[];
  fileMode?: FileMode;
  fields?: SelectableField<CMap[C]>[];
  with?: TypedWithInput<CMap, CMap[C]>;
  contentAs?: CF;
  htmlOptions?: RenderOptions;
  markdownOptions?: MarkdownOptions;
  locale?: QueryLocale<CMap>;
  fallback?: QueryLocale<CMap> | false;
};

export interface TypedAllFn<CMap> {
  <C extends keyof CMap & string>(collection: C): { collection: C };
  <C extends keyof CMap & string>(collection: C, filter: string): { collection: C; filter: string };
  <C extends keyof CMap & string>(
    collection: C,
    filter: (self: ItemRef<CMap[C]>) => string,
  ): { collection: C; filter: (self: ItemRef<CMap[C]>) => string };
  <
    C extends keyof CMap & string,
    CF extends ContentFormat = "object",
    const O extends EntryOpts<CMap, C, CF> = EntryOpts<CMap, C, CF>,
  >(
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
  <
    C extends keyof CMap & string,
    CF extends ContentFormat = "object",
    const O extends EntryOpts<CMap, C, CF> = EntryOpts<CMap, C, CF>,
  >(
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

  /**
   * Returns a new query fn scoped to the given locale. Useful for SSR per-request scoping without mutating the shared client.
   * The optional `fallback` overrides the client-configured fallback for this scope (`false` disables).
   */
  withLocale(
    locale: QueryLocale<CMap>,
    fallback?: QueryLocale<CMap> | false,
  ): TypedContfuClient<CMap>;

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
    CF extends ContentFormat = "object",
  >(
    collection: C,
    opts: Omit<EntryOpts<CMap, C, CF>, "with" | "fields"> & {
      fields?: F;
      with: (parent: ItemRef<CMap[C]>) => W;
    },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, CF>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
    CF extends ContentFormat = "object",
  >(
    collection: C,
    opts: Omit<EntryOpts<CMap, C, CF>, "with" | "fields"> & { fields?: F; with: W },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, CF>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    CF extends ContentFormat = "object",
  >(
    collection: C,
    opts?: Omit<EntryOpts<CMap, C, CF>, "fields"> & { fields?: F },
  ): Promise<TypedQueryResult<PickFields<CMap[C], F>, CF>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
    CF extends ContentFormat = "object",
  >(
    options: TypedQueryEntry<CMap, C, F, CF> & {
      collection: C;
      with: (parent: ItemRef<CMap[C]>) => W;
    },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, CF>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    const W extends { [rel: string]: TypedWithEntry<CMap, any> } = {
      [rel: string]: TypedWithEntry<CMap, any>;
    },
    CF extends ContentFormat = "object",
  >(
    options: TypedQueryEntry<CMap, C, F, CF> & { collection: C; with: W },
  ): Promise<TypedQueryResultWithRels<PickFields<CMap[C], F>, InferRels<CMap, W>, CF>>;

  <
    C extends keyof CMap & string,
    const F extends readonly SelectableField<CMap[C]>[] | undefined = undefined,
    CF extends ContentFormat = "object",
  >(
    options: TypedQueryEntry<CMap, C, F, CF> & { collection: C },
  ): Promise<TypedQueryResult<PickFields<CMap[C], F>, CF>>;

  (options?: QueryOptions): Promise<QueryResult>;
}

export type TypedContfuClient<CMap> = TypedContfuClientBase<CMap>;
