import { and, asc, desc, eq, gte, like, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { encodeId } from "../../infra/ids";
import type { ItemData } from "../../infra/types/content-types";
import { collectionTable, itemsTable } from "../../infra/db/schema";
import { getCollectionId } from "../collections/getCollectionId";

export type ItemSortField = "changedAt" | "ref" | "collection";
export type SortDirection = "asc" | "desc";
export type ItemPropFilterOperator = "eq" | "contains";

export type ItemPropFilter = {
  key: string;
  op: ItemPropFilterOperator;
  value: string | number | boolean;
};

export type QueryItemsInput = {
  collection?: string;
  search?: string;
  changedAtFrom?: number;
  changedAtTo?: number;
  propFilters?: ItemPropFilter[];
  sortField?: ItemSortField;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
};

export type QueryItemsResult = {
  items: ItemData[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const ALLOWED_PAGE_SIZES = [10, 20, 50, 100] as const;

function normalizePage(input: number | undefined): number {
  if (!Number.isFinite(input) || !input || input < 1) return 1;
  return Math.floor(input);
}

function normalizePageSize(input: number | undefined): number {
  if (!Number.isFinite(input) || !input) return 20;

  if (input <= ALLOWED_PAGE_SIZES[0]) return ALLOWED_PAGE_SIZES[0];
  if (input >= ALLOWED_PAGE_SIZES[ALLOWED_PAGE_SIZES.length - 1]) {
    return ALLOWED_PAGE_SIZES[ALLOWED_PAGE_SIZES.length - 1];
  }

  let nearest: number = ALLOWED_PAGE_SIZES[0];
  let nearestDistance = Math.abs(input - nearest);
  for (const candidate of ALLOWED_PAGE_SIZES) {
    const distance = Math.abs(input - candidate);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function normalizeSortField(input: ItemSortField | undefined): ItemSortField {
  if (!input) return "changedAt";
  return input;
}

function normalizeSortDirection(input: SortDirection | undefined): SortDirection {
  if (!input) return "desc";
  return input;
}

function parseJsonValue(value: string | null): unknown {
  if (!value) return undefined;

  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function coerceFilterValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "";
}

function matchesPropFilters(
  props: Record<string, unknown>,
  filters: ItemPropFilter[] | undefined,
): boolean {
  if (!filters || filters.length === 0) return true;

  return filters.every((filter) => {
    const propValue = props[filter.key];

    if (filter.op === "eq") {
      return JSON.stringify(propValue) === JSON.stringify(filter.value);
    }

    if (typeof propValue !== "string") {
      return false;
    }

    return propValue.toLowerCase().includes(coerceFilterValue(filter.value).toLowerCase());
  });
}

function compareItems(
  a: ItemData,
  b: ItemData,
  sortField: ItemSortField,
  sortDirection: SortDirection,
): number {
  let primary = 0;

  if (sortField === "changedAt") {
    primary = a.changedAt - b.changedAt;
  } else if (sortField === "ref") {
    primary = a.ref.localeCompare(b.ref);
  } else {
    primary = a.collection.localeCompare(b.collection);
  }

  if (primary === 0) {
    return a.ref.localeCompare(b.ref);
  }

  return sortDirection === "asc" ? primary : -primary;
}

export async function queryItems(input: QueryItemsInput = {}, ctx = db): Promise<QueryItemsResult> {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const sortField = normalizeSortField(input.sortField);
  const sortDirection = normalizeSortDirection(input.sortDirection);

  const whereConditions: SQL[] = [];

  const collectionName = input.collection?.trim();
  if (collectionName) {
    const collectionId = await getCollectionId(collectionName, ctx);
    if (collectionId === null) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }

    whereConditions.push(eq(itemsTable.collection, collectionId));
  }

  const search = input.search?.trim();
  if (search) {
    whereConditions.push(like(sql`lower(${itemsTable.ref})`, `%${search.toLowerCase()}%`));
  }

  if (typeof input.changedAtFrom === "number") {
    whereConditions.push(gte(itemsTable.changedAt, input.changedAtFrom));
  }

  if (typeof input.changedAtTo === "number") {
    whereConditions.push(lte(itemsTable.changedAt, input.changedAtTo));
  }

  const orderBy = [
    sortField === "changedAt"
      ? sortDirection === "asc"
        ? asc(itemsTable.changedAt)
        : desc(itemsTable.changedAt)
      : sortField === "ref"
        ? sortDirection === "asc"
          ? asc(itemsTable.ref)
          : desc(itemsTable.ref)
        : sortDirection === "asc"
          ? asc(collectionTable.name)
          : desc(collectionTable.name),
    asc(itemsTable.ref),
  ];

  const rawRows =
    whereConditions.length > 0
      ? await ctx
          .select()
          .from(itemsTable)
          .innerJoin(collectionTable, eq(itemsTable.collection, collectionTable.id))
          .where(and(...whereConditions))
          .orderBy(...orderBy)
          .all()
      : await ctx
          .select()
          .from(itemsTable)
          .innerJoin(collectionTable, eq(itemsTable.collection, collectionTable.id))
          .orderBy(...orderBy)
          .all();

  const filtered = rawRows
    .map((row): ItemData => {
      const props = parseJsonValue(row.items.props);
      const content = parseJsonValue(row.items.content);

      return {
        id: encodeId(row.items.id),
        ref: row.items.ref,
        collection: row.collection.name,
        props: (props && typeof props === "object" ? props : {}) as Record<string, unknown>,
        content: Array.isArray(content) ? content : undefined,
        changedAt: row.items.changedAt,
        links: { content: [] },
      };
    })
    .filter((item) => matchesPropFilters(item.props, input.propFilters))
    .sort((a, b) => compareItems(a, b, sortField, sortDirection));

  const total = filtered.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}
