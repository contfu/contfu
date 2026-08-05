import { and, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { propsWithLocale } from "../../infra/db/mappers";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import { collectionsTable, itemsTable } from "../../infra/db/schema";
import { findItems } from "./findItems";
import {
  formatPlainDateResults,
  type CollectionSchema,
  type IncludeOption,
  type PlainDateOutput,
  type WithClause,
} from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";

export function getItemById(
  id: number,
  options?: {
    include?: IncludeOption[];
    with?: WithClause;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    plainDatesAs?: PlainDateOutput;
  },
  ctx = defaultDb,
): ItemWithRelations | null {
  const conditions: SQL[] = [eq(itemsTable.id, id)];
  if (options?.onlyDeleted) {
    conditions.push(isNotNull(itemsTable.deletedAt));
  } else if (!options?.includeDeleted) {
    conditions.push(isNull(itemsTable.deletedAt));
  }

  const row = ctx
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
    .where(and(...conditions))
    .get();

  if (!row) return null;

  const props = propsWithLocale(
    row.props && typeof row.props === "object" && !Array.isArray(row.props) ? row.props : {},
    row.locale,
  );

  const item: ItemWithRelations = {
    $id: row.id,
    $collection: row.collectionName,
    $changedAt: row.changedAt,
    ...(row.deletedAt != null ? { $deletedAt: row.deletedAt } : {}),
    ...props,
    content: Array.isArray(row.content) ? row.content : undefined,
    links: [],
  };

  const includes = options?.include?.filter((i) => i !== "content") ?? [];
  if (includes.length > 0) {
    resolveIncludes([item], includes, ctx);
  }

  if (options?.with && Object.keys(options.with).length > 0) {
    resolveRelations([item], options.with, findItems, ctx, 0, [], options.plainDatesAs);
  }

  const schemas = new Map<string, CollectionSchema>(
    ctx
      .select({ name: collectionsTable.name, schema: collectionsTable.schema })
      .from(collectionsTable)
      .all()
      .map((entry) => [entry.name, entry.schema]),
  );
  return formatPlainDateResults(item, schemas, options?.plainDatesAs ?? "string");
}
