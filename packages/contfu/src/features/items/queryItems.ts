import { and, asc, count, desc, eq, gte, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "../../infra/db/db";
import { propsWithLocale } from "../../infra/db/mappers";
import { itemsTable } from "../../infra/db/schema";
import type { ItemData } from "../../infra/types/content-types";

export type ItemSortField = "changedAt" | "collection";
export type SortDirection = "asc" | "desc";
export type ItemPropFilterOperator = "eq" | "contains";

export type ItemPropFilter = {
  key: string;
  op: ItemPropFilterOperator;
  value: string | number | boolean;
};

export type QueryItemsInput = {
  collection?: string;
  changedAtFrom?: number;
  changedAtTo?: number;
  propFilters?: ItemPropFilter[];
  sortField?: ItemSortField;
  sortDirection?: SortDirection;
  page?: number;
  pageSize?: number;
  includeDeleted?: boolean;
  onlyDeleted?: boolean;
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

/**
 * Use a quoted JSON path segment so property names are treated as literal keys
 * (rather than as paths), matching the direct `props[key]` lookup this API used
 * before filters moved into SQLite.
 */
function jsonPropertyPath(key: string): string {
  return `$."${key.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function propertyExpression(key: string): SQL {
  // $locale is a synthetic property supplied from the separate locale column.
  if (key === "$locale") return sql`${itemsTable.locale}`;
  return sql`json_extract(${itemsTable.props}, ${jsonPropertyPath(key)})`;
}

function escapedLikeValue(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

// SQLite's built-in lower() only folds ASCII. Keep this compatible with
// JavaScript toLowerCase() behavior for non-ASCII Latin characters by
// explicitly folding their uppercase forms.
const LATIN_CASE_PAIRS: readonly [string, string][] = [
  ["À", "à"],
  ["Á", "á"],
  ["Â", "â"],
  ["Ã", "ã"],
  ["Ä", "ä"],
  ["Å", "å"],
  ["Æ", "æ"],
  ["Ç", "ç"],
  ["È", "è"],
  ["É", "é"],
  ["Ê", "ê"],
  ["Ë", "ë"],
  ["Ì", "ì"],
  ["Í", "í"],
  ["Î", "î"],
  ["Ï", "ï"],
  ["Ð", "ð"],
  ["Ñ", "ñ"],
  ["Ò", "ò"],
  ["Ó", "ó"],
  ["Ô", "ô"],
  ["Õ", "õ"],
  ["Ö", "ö"],
  ["Ø", "ø"],
  ["Ù", "ù"],
  ["Ú", "ú"],
  ["Û", "û"],
  ["Ü", "ü"],
  ["Ý", "ý"],
  ["Þ", "þ"],
];
const LATIN_ACCENT_PAIRS: readonly [string, string][] = [
  ["à", "a"],
  ["á", "a"],
  ["â", "a"],
  ["ã", "a"],
  ["ä", "a"],
  ["å", "a"],
  ["æ", "ae"],
  ["ç", "c"],
  ["è", "e"],
  ["é", "e"],
  ["ê", "e"],
  ["ë", "e"],
  ["ì", "i"],
  ["í", "i"],
  ["î", "i"],
  ["ï", "i"],
  ["ð", "d"],
  ["ñ", "n"],
  ["ò", "o"],
  ["ó", "o"],
  ["ô", "o"],
  ["õ", "o"],
  ["ö", "o"],
  ["ø", "o"],
  ["ù", "u"],
  ["ú", "u"],
  ["û", "u"],
  ["ü", "u"],
  ["ý", "y"],
  ["þ", "th"],
];

function foldedTextExpression(value: SQL): SQL {
  let expression: SQL = sql`lower(${value})`;
  for (const [upper, lower] of LATIN_CASE_PAIRS) {
    expression = sql`replace(${expression}, ${upper}, ${lower})`;
  }
  return expression;
}

function collectionSortExpression(): SQL {
  let expression: SQL = foldedTextExpression(sql`${itemsTable.collection}`);
  // Strip accents for the primary comparison, matching the primary ordering
  // used by String.localeCompare() rather than SQLite's binary collation.
  for (const [accented, plain] of LATIN_ACCENT_PAIRS) {
    expression = sql`replace(${expression}, ${accented}, ${plain})`;
  }
  return expression;
}

function collectionCaseExpression(): SQL {
  // Intl/localeCompare places lowercase before uppercase when otherwise equal.
  return sql`CASE WHEN ${itemsTable.collection} GLOB '*[A-Z]*' THEN 1 ELSE 0 END`;
}

function collectionRawExpression(): SQL {
  return foldedTextExpression(sql`${itemsTable.collection}`);
}

function propertyTypeExpression(key: string): SQL {
  return key === "$locale"
    ? sql`typeof(${itemsTable.locale})`
    : sql`json_type(${itemsTable.props}, ${jsonPropertyPath(key)})`;
}

function isValidPropFilter(value: unknown): value is ItemPropFilter {
  if (value === null || typeof value !== "object") return false;
  const filter = value as Partial<ItemPropFilter>;
  return (
    typeof filter.key === "string" &&
    (filter.op === "eq" || filter.op === "contains") &&
    (typeof filter.value === "string" ||
      typeof filter.value === "boolean" ||
      (typeof filter.value === "number" && Number.isFinite(filter.value)))
  );
}

function buildPropFilter(filter: ItemPropFilter): SQL {
  const expression = propertyExpression(filter.key);
  const type = propertyTypeExpression(filter.key);

  if (filter.op === "eq") {
    // SQLite compares JSON booleans as 0/1, so retain the source JSON type to
    // avoid making true equal to 1 (the old JSON.stringify contract did not).
    const value = typeof filter.value === "boolean" ? (filter.value ? 1 : 0) : filter.value;
    const expectedType =
      typeof filter.value === "boolean"
        ? filter.value
          ? "true"
          : "false"
        : typeof filter.value === "number"
          ? "number"
          : "text";
    const typeMatches =
      expectedType === "number"
        ? sql`${type} IN ('integer', 'real')`
        : sql`${type} = ${expectedType}`;
    return and(typeMatches, eq(expression, sql`${value}`))!;
  }

  // LIKE is escaped because contains() treats wildcard characters literally.
  // Check the source JSON type rather than json_type(expression): the latter
  // attempts to parse an extracted string as JSON and rejects plain text.
  const pattern = `%${escapedLikeValue(String(filter.value).toLowerCase())}%`;
  return sql`${type} = 'text' AND ${foldedTextExpression(expression)} LIKE ${pattern} ESCAPE '\\'`;
}

export function queryItems(input: QueryItemsInput = {}, ctx = db): QueryItemsResult {
  const page = normalizePage(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  const sortField = normalizeSortField(input.sortField);
  const sortDirection = normalizeSortDirection(input.sortDirection);

  const whereConditions: SQL[] = [];

  if (input.onlyDeleted) {
    whereConditions.push(isNotNull(itemsTable.deletedAt));
  } else if (!input.includeDeleted) {
    whereConditions.push(isNull(itemsTable.deletedAt));
  }

  const collectionName = input.collection?.trim();
  if (collectionName) {
    whereConditions.push(eq(itemsTable.collection, collectionName));
  }

  if (typeof input.changedAtFrom === "number") {
    whereConditions.push(gte(itemsTable.changedAt, input.changedAtFrom));
  }

  if (typeof input.changedAtTo === "number") {
    whereConditions.push(lte(itemsTable.changedAt, input.changedAtTo));
  }

  if (input.propFilters) {
    if (!Array.isArray(input.propFilters)) {
      whereConditions.push(sql`0`);
    } else {
      for (const filter of input.propFilters) {
        // Query inputs can originate at the HTTP boundary despite the static
        // type. Invalid filters must not reach string/path operations.
        whereConditions.push(isValidPropFilter(filter) ? buildPropFilter(filter) : sql`0`);
      }
    }
  }

  const where = whereConditions.length > 0 ? and(...whereConditions) : undefined;
  const orderBy = [
    sortField === "changedAt"
      ? sortDirection === "asc"
        ? asc(itemsTable.changedAt)
        : desc(itemsTable.changedAt)
      : sortDirection === "asc"
        ? sql`${collectionSortExpression()} ASC, ${collectionCaseExpression()} ASC, ${collectionRawExpression()} ASC`
        : sql`${collectionSortExpression()} DESC, ${collectionCaseExpression()} DESC, ${collectionRawExpression()} DESC`,
    asc(itemsTable.id),
  ];

  // Keep the count and page queries on the exact same predicate. The count
  // query only reads the aggregate, while the page query applies the bounds
  // before any rows are decoded into ItemData.
  const totalRow = ctx
    .select({ total: count(itemsTable.id) })
    .from(itemsTable)
    .where(where)
    .get();
  const total = totalRow?.total ?? 0;
  const start = (page - 1) * pageSize;

  const pageQuery = ctx
    .select({
      id: itemsTable.id,
      collectionName: itemsTable.collection,
      props: itemsTable.props,
      locale: itemsTable.locale,
      content: itemsTable.content,
      changedAt: itemsTable.changedAt,
      deletedAt: itemsTable.deletedAt,
    })
    .from(itemsTable)
    .where(where)
    .orderBy(...orderBy)
    .limit(pageSize)
    .offset(start);

  const items = pageQuery.all().map((row): ItemData => {
    const props = row.props;
    const content = row.content;

    return {
      id: row.id,
      collection: row.collectionName,
      props: propsWithLocale(props && typeof props === "object" ? props : {}, row.locale),
      content: Array.isArray(content) ? content : undefined,
      changedAt: row.changedAt,
      deletedAt: row.deletedAt ?? undefined,
      links: [],
    };
  });

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages,
  };
}
