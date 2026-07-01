import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { collectionsTable, itemsTable } from "../../infra/db/schema";
import { propsWithLocale } from "../../infra/db/mappers";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import { compileFilter } from "../../infra/filter/compiler";
import { tokenize } from "../../infra/filter/lexer";
import { parse } from "../../infra/filter/parser";
import { QueryResultArray, type QueryOptions, type SortOption } from "@contfu/core";
import type { ItemWithRelations, QueryResult, QuerySystemFields } from "../../domain/query-types";
import {
  buildI18nQueryPlan,
  filterReferencesLocale,
  type ClientI18nConfig,
  type I18nQueryPlan,
  type LocaleScope,
} from "../../domain/i18n";

const DEFAULT_LIMIT = 20;

type SelectableFieldMap = QuerySystemFields & Record<string, unknown>;

type DbRow = {
  id: number;
  collectionName: string;
  props: unknown;
  locale: string | null;
  changedAt: number;
  deletedAt: number | null;
  content?: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function flattenProps(
  props: Record<string, unknown>,
  prefix = "",
  result: Record<string, unknown> = {},
): Record<string, unknown> {
  for (const [key, value] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      flattenProps(value, path, result);
    } else {
      result[path] = value;
    }
  }
  return result;
}

function toSelectableFields(row: DbRow, flat = false) {
  const props = propsWithLocale(isPlainObject(row.props) ? row.props : {}, row.locale);

  return {
    $id: row.id,
    $collection: row.collectionName,
    $changedAt: row.changedAt,
    ...(row.deletedAt != null ? { $deletedAt: row.deletedAt } : {}),
    ...(flat ? flattenProps(props) : props),
  };
}

function localeColumnExpr(): SQL {
  return sql`${itemsTable.locale}`;
}

function keyJsonExpr(keyField: string): SQL {
  return sql`json_extract(${itemsTable.props}, ${"$." + keyField})`;
}

function extractCollectionName(filter: string | undefined): string | undefined {
  if (!filter) return undefined;
  const match = filter.match(/\$collection\s*=\s*"([^"]+)"/);
  return match?.[1];
}

function resolveI18nPlan(
  options: QueryOptions,
  ctx: typeof defaultDb,
  appI18n?: ClientI18nConfig,
  scope?: LocaleScope,
): { plan?: I18nQueryPlan; ast?: ReturnType<typeof parse> } {
  const collection = extractCollectionName(options.filter);
  let ast: ReturnType<typeof parse> | undefined;
  let suppressImplicit = false;

  if (options.filter) {
    ast = parse(tokenize(options.filter));
    suppressImplicit = filterReferencesLocale(ast);
  }

  if (!collection) return { ast };

  const row = ctx
    .select({ i18n: collectionsTable.i18n })
    .from(collectionsTable)
    .where(eq(collectionsTable.name, collection))
    .get();

  const plan = buildI18nQueryPlan({
    collection,
    collectionI18n: row?.i18n ?? undefined,
    appI18n,
    scope,
    locale: options.locale,
    fallback: options.fallback,
    suppressImplicit,
  });

  return { plan, ast };
}

function buildWhere(
  options: QueryOptions,
  ast?: ReturnType<typeof parse>,
  i18nPlan?: I18nQueryPlan,
): SQL | undefined {
  const conditions: SQL[] = [];

  if (options.onlyDeleted) {
    conditions.push(isNotNull(itemsTable.deletedAt));
  } else if (!options.includeDeleted) {
    conditions.push(isNull(itemsTable.deletedAt));
  }

  if (ast) {
    conditions.push(compileFilter(ast));
  }

  if (options.search) {
    const pattern = `%${options.search}%`;
    conditions.push(sql`json_extract(${itemsTable.props}, '$.title') LIKE ${pattern}`);
  }

  if (i18nPlan?.wantedLocale) {
    const localeCol = localeColumnExpr();
    if (i18nPlan.fallbackLocale && i18nPlan.fallbackLocale !== i18nPlan.wantedLocale) {
      conditions.push(inArray(localeCol, [i18nPlan.wantedLocale, i18nPlan.fallbackLocale]));
    } else {
      conditions.push(eq(localeCol, i18nPlan.wantedLocale));
    }
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}

function buildOrderBy(sort: SortOption | SortOption[] | undefined) {
  if (!sort) return [desc(itemsTable.changedAt), asc(itemsTable.id)];

  const sorts = Array.isArray(sort) ? sort : [sort];
  const clauses = sorts.map((s) => {
    if (typeof s === "string") {
      if (s.startsWith("-")) {
        return descColumn(s.slice(1));
      }
      return ascColumn(s);
    }
    return s.direction === "desc" ? descColumn(s.field) : ascColumn(s.field);
  });

  clauses.push(asc(itemsTable.id));
  return clauses;
}

function ascColumn(field: string) {
  return asc(resolveColumn(field));
}

function descColumn(field: string) {
  return desc(resolveColumn(field));
}

function resolveColumn(field: string) {
  if (field === "$collection") return itemsTable.collection;
  if (field === "$changedAt") return itemsTable.changedAt;
  if (field === "$id") return itemsTable.id;
  if (field === "$locale") return localeColumnExpr();
  return sql`json_extract(${itemsTable.props}, ${"$." + field})`;
}

function pickRequestedFields(
  rawItem: SelectableFieldMap,
  resolvedItem: ItemWithRelations,
  fields: string[] | undefined,
): ItemWithRelations {
  const projected: Record<string, unknown> = {};

  if (fields === undefined) {
    Object.assign(projected, rawItem);
  } else {
    for (const field of fields) {
      if (field in rawItem) {
        projected[field] = rawItem[field];
      }
    }
  }

  for (const [key, value] of Object.entries(resolvedItem)) {
    if (!(key in rawItem) || rawItem[key] !== value) {
      projected[key] = value;
    }
  }

  return projected as ItemWithRelations;
}

export function findItems(
  options: QueryOptions = {},
  ctx = defaultDb,
  appI18n?: ClientI18nConfig,
  scope?: LocaleScope,
): QueryResult {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const offset = Math.max(0, options.offset ?? 0);

  const { plan: i18nPlan, ast } = resolveI18nPlan(options, ctx, appI18n, scope);
  const where = buildWhere(options, ast, i18nPlan);
  const orderBy = buildOrderBy(options.sort);

  const explicitIncludeContent = options.include?.includes("content");

  const contentCollections = new Set<string>();
  const schemaRows = ctx
    .select({ name: collectionsTable.name, schema: collectionsTable.schema })
    .from(collectionsTable)
    .all();
  for (const row of schemaRows) {
    if (row.schema && typeof row.schema === "object" && "$content" in row.schema) {
      contentCollections.add(row.name);
    }
  }

  const includeContentColumn = explicitIncludeContent || contentCollections.size > 0;
  const selectColumns = {
    id: itemsTable.id,
    collectionName: itemsTable.collection,
    props: itemsTable.props,
    locale: itemsTable.locale,
    changedAt: itemsTable.changedAt,
    deletedAt: itemsTable.deletedAt,
    ...(includeContentColumn ? { content: itemsTable.content } : {}),
  };

  const fallbackApplies = Boolean(
    i18nPlan?.wantedLocale &&
    i18nPlan.fallbackLocale &&
    i18nPlan.fallbackLocale !== i18nPlan.wantedLocale,
  );
  if (fallbackApplies && !i18nPlan?.key) {
    throw new Error(
      `Cannot apply i18n fallback for collection '${i18nPlan?.collection}': missing fallback grouping key`,
    );
  }

  const useFallbackGroup = Boolean(fallbackApplies && i18nPlan?.key);

  let rows: DbRow[];
  let total: number;

  if (useFallbackGroup && i18nPlan?.key) {
    const localeCol = localeColumnExpr();
    const keyCol = keyJsonExpr(i18nPlan.key);
    const wantedLocale = i18nPlan.wantedLocale!;
    const fallbackLocale = i18nPlan.fallbackLocale!;
    const prefExpr = sql`MIN(CASE ${localeCol} WHEN ${wantedLocale} THEN 0 WHEN ${fallbackLocale} THEN 1 ELSE 2 END)`;
    const query = ctx.select({ ...selectColumns, _pref: prefExpr }).from(itemsTable);

    rows = (where ? query.where(where) : query)
      .groupBy(keyCol)
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset)
      .all() as unknown as DbRow[];

    const countRow = ctx
      .select({ value: sql<number>`COUNT(DISTINCT ${keyCol})` })
      .from(itemsTable)
      .where(where)
      .get();
    total = countRow?.value ?? 0;
  } else {
    const query = ctx.select(selectColumns).from(itemsTable);
    rows = (
      where
        ? query
            .where(where)
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset)
            .all()
        : query
            .orderBy(...orderBy)
            .limit(limit)
            .offset(offset)
            .all()
    ) as DbRow[];

    const countQuery = ctx.select({ value: count() }).from(itemsTable);
    total = (where ? countQuery.where(where).get() : countQuery.get())?.value ?? 0;
  }

  const rawItems = rows.map((row) => toSelectableFields(row, options.flat));

  const data: ItemWithRelations[] = rows.map((row, index) => {
    const shouldEmitContent =
      "content" in row &&
      row.content &&
      (explicitIncludeContent || contentCollections.has(row.collectionName));
    return {
      ...rawItems[index],
      ...(shouldEmitContent
        ? { content: Array.isArray(row.content) ? row.content : undefined }
        : {}),
      links: [],
    };
  });

  const includes = options.include?.filter((i) => i !== "content") ?? [];
  if (includes.length > 0) {
    resolveIncludes(data, includes, ctx, { filesBasePath: options.filesBasePath });
  }

  if (options.with && Object.keys(options.with).length > 0) {
    resolveRelations(data, options.with, findItems, ctx);
  }

  return new QueryResultArray(
    data.map((item, index) =>
      pickRequestedFields(rawItems[index] as SelectableFieldMap, item, options.fields),
    ),
    { total, limit, offset },
  );
}
