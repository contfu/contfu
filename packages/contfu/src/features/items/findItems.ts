import { and, asc, count, desc, sql, type SQL } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { collectionsTable, itemsTable } from "../../infra/db/schema";
import { encodeId } from "../../infra/ids";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import { compileFilter } from "../../infra/filter/compiler";
import { tokenize } from "../../infra/filter/lexer";
import { parse } from "../../infra/filter/parser";
import { QueryResultArray, type QueryOptions, type SortOption } from "@contfu/core";
import type { ItemWithRelations, QueryResult, QuerySystemFields } from "../../domain/query-types";

const DEFAULT_LIMIT = 20;

type SelectableFieldMap = QuerySystemFields & Record<string, unknown>;

function encodeDbId(value: ArrayBuffer | Buffer | Uint8Array): string {
  if (Buffer.isBuffer(value)) return encodeId(value);
  if (value instanceof Uint8Array) return encodeId(Buffer.from(value));
  return encodeId(Buffer.from(new Uint8Array(value)));
}

function toSelectableFields(row: {
  id: Uint8Array | Buffer | ArrayBuffer;
  connectionType: number | null;
  ref: string | null;
  collectionName: string;
  props: unknown;
  changedAt: number;
}) {
  const props =
    row.props && typeof row.props === "object" && !Array.isArray(row.props)
      ? (row.props as Record<string, unknown>)
      : {};

  return {
    $id: encodeDbId(row.id),
    $connectionType: row.connectionType as QuerySystemFields["$connectionType"],
    $ref: row.ref,
    $collection: row.collectionName,
    $changedAt: row.changedAt,
    ...props,
  };
}

function buildWhere(options: QueryOptions): SQL | undefined {
  const conditions: SQL[] = [];

  if (options.filter) {
    const ast = parse(tokenize(options.filter));
    conditions.push(compileFilter(ast));
  }

  if (options.search) {
    const pattern = `%${options.search}%`;
    conditions.push(
      sql`(json_extract(${itemsTable.props}, '$.title') LIKE ${pattern} OR ${itemsTable.ref} LIKE ${pattern})`,
    );
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
  if (field === "$ref") return itemsTable.ref;
  if (field === "$connectionType") return itemsTable.connectionType;
  if (field === "$id") return itemsTable.id;
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

export function findItems(options: QueryOptions = {}, ctx = defaultDb): QueryResult {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const offset = Math.max(0, options.offset ?? 0);

  const where = buildWhere(options);
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
    connectionType: itemsTable.connectionType,
    ref: itemsTable.ref,
    collectionName: itemsTable.collection,
    props: itemsTable.props,
    changedAt: itemsTable.changedAt,
    ...(includeContentColumn ? { content: itemsTable.content } : {}),
  };

  const query = ctx.select(selectColumns).from(itemsTable);

  const rows = where
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
        .all();

  const countQuery = ctx.select({ value: count() }).from(itemsTable);
  const total = (where ? countQuery.where(where).get() : countQuery.get())?.value ?? 0;

  const rawItems = rows.map((row) => toSelectableFields(row));

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
    resolveIncludes(data, includes, ctx);
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
