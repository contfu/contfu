import { and, asc, count, desc, sql, type SQL } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { encodeId } from "../../infra/ids";
import { compileFilter } from "../../infra/filter/compiler";
import { tokenize } from "../../infra/filter/lexer";
import { parse } from "../../infra/filter/parser";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import type {
  QueryOptions,
  QueryResult,
  ItemWithRelations,
  SortOption,
} from "../../domain/query-types";

const DEFAULT_LIMIT = 20;

function flattenItem(item: ItemWithRelations): Record<string, unknown> {
  const { props, rels, ...core } = item;
  const flatRels: Record<string, unknown> = {};
  if (rels) {
    for (const [key, value] of Object.entries(rels)) {
      if (value === null) {
        flatRels[key] = null;
      } else if (Array.isArray(value)) {
        flatRels[key] = value.map(flattenItem);
      } else {
        flatRels[key] = flattenItem(value);
      }
    }
  }
  return { ...core, ...props, ...flatRels };
}

function buildWhere(options: QueryOptions): SQL | undefined {
  const conditions: SQL[] = [];

  if (options.filter) {
    const ast = parse(tokenize(options.filter));
    conditions.push(compileFilter(ast));
  }

  if (options.search) {
    // Search across title prop and ref
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
      // "field" or "-field" for desc
      if (s.startsWith("-")) {
        return descColumn(s.slice(1));
      }
      return ascColumn(s);
    }
    return s.direction === "desc" ? descColumn(s.field) : ascColumn(s.field);
  });

  // Always add id tiebreaker
  clauses.push(asc(itemsTable.id));
  return clauses;
}

function ascColumn(field: string) {
  const col = resolveColumn(field);
  return asc(col);
}

function descColumn(field: string) {
  const col = resolveColumn(field);
  return desc(col);
}

function resolveColumn(field: string) {
  if (field === "collection") return itemsTable.collection;
  if (field === "changedAt") return itemsTable.changedAt;
  if (field === "ref") return itemsTable.ref;
  if (field === "connectionType") return itemsTable.connectionType;
  // Props field
  const prop = field.startsWith("props.") ? field.slice(6) : field;
  return sql`json_extract(${itemsTable.props}, ${"$." + prop})`;
}

export function findItems(options: QueryOptions = {}, ctx = defaultDb): QueryResult {
  const limit = Math.max(1, options.limit ?? DEFAULT_LIMIT);
  const offset = Math.max(0, options.offset ?? 0);

  const where = buildWhere(options);
  const orderBy = buildOrderBy(options.sort);

  const includeContent = options.include?.includes("content");

  // Build select columns — exclude content by default
  const selectColumns = {
    id: itemsTable.id,
    connectionType: itemsTable.connectionType,
    ref: itemsTable.ref,
    collectionName: itemsTable.collection,
    props: itemsTable.props,
    changedAt: itemsTable.changedAt,
    ...(includeContent ? { content: itemsTable.content } : {}),
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

  // Count query
  const countQuery = ctx.select({ value: count() }).from(itemsTable);
  const total = (where ? countQuery.where(where).get() : countQuery.get())?.value ?? 0;

  // Map to domain objects
  const data: ItemWithRelations[] = rows.map((row) => {
    const props = row.props;
    return {
      id: encodeId(row.id),
      connectionType: row.connectionType,
      ref: row.ref,
      collection: row.collectionName,
      props: (props && typeof props === "object" ? props : {}) as Record<string, unknown>,
      changedAt: row.changedAt,
      ...("content" in row && row.content
        ? { content: Array.isArray(row.content) ? row.content : undefined }
        : {}),
      links: [],
    };
  });

  // Resolve includes (assets, links)
  const includes = options.include?.filter((i) => i !== "content") ?? [];
  if (includes.length > 0) {
    resolveIncludes(data, includes, ctx);
  }

  // Resolve computed relations
  if (options.with && Object.keys(options.with).length > 0) {
    resolveRelations(data, options.with, findItems, ctx);
  }

  if (options.flat) {
    return { data: data.map(flattenItem) as any, meta: { total, limit, offset } };
  }

  return {
    data,
    meta: { total, limit, offset },
  };
}
