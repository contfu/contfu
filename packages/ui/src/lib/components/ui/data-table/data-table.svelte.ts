import { createTable } from "@tanstack/svelte-table";
import {
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  stockFeatures,
  tableFeatures,
  type RowData,
  type TableOptions,
} from "@tanstack/table-core";

const features = tableFeatures({
  ...stockFeatures,
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortedRowModel: createSortedRowModel(),
});

/**
 * Creates a reactive TanStack Table v9 instance with all built-in features.
 *
 * The wrapper keeps the existing local API while centralising the v9 feature
 * registration required by TanStack Table.
 */
export function createSvelteTable<TData extends RowData>(
  options: Omit<TableOptions<any, TData>, "features">,
) {
  return createTable(mergeObjects(options, { features }) as TableOptions<any, TData>);
}

type MaybeThunk<T extends object> = T | (() => T | null | undefined);
type Intersection<T extends readonly unknown[]> = (T extends [infer H, ...infer R]
  ? H & Intersection<R>
  : unknown) & {};

/**
 * Lazily merges objects while preserving getter semantics for reactive table
 * options such as `data`, `columns`, and `state`.
 */
function mergeObjects<Sources extends readonly MaybeThunk<any>[]>(
  ...sources: Sources
): Intersection<{ [K in keyof Sources]: Sources[K] }> {
  const resolve = <T extends object>(src: MaybeThunk<T>): T | undefined =>
    typeof src === "function" ? (src() ?? undefined) : src;

  const findSourceWithKey = (key: PropertyKey) => {
    for (let i = sources.length - 1; i >= 0; i--) {
      const obj = resolve(sources[i]);
      if (obj && key in obj) return obj;
    }
    return undefined;
  };

  return new Proxy(Object.create(null), {
    get(_, key) {
      const src = findSourceWithKey(key);
      return src?.[key as never];
    },
    has(_, key) {
      return !!findSourceWithKey(key);
    },
    ownKeys(): (string | symbol)[] {
      const all = new Set<string | symbol>();
      for (const source of sources) {
        const obj = resolve(source);
        if (obj) for (const key of Reflect.ownKeys(obj)) all.add(key);
      }
      return [...all];
    },
    getOwnPropertyDescriptor(_, key) {
      const src = findSourceWithKey(key);
      if (!src) return undefined;
      return { configurable: true, enumerable: true, value: src[key as never], writable: true };
    },
  }) as Intersection<{ [K in keyof Sources]: Sources[K] }>;
}
