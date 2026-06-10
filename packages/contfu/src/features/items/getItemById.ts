import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { propsWithLocale } from "../../infra/db/mappers";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import { itemsTable } from "../../infra/db/schema";
import { findItems } from "./findItems";
import type { IncludeOption, WithClause } from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";

export function getItemById(
  id: number,
  options?: { include?: IncludeOption[]; with?: WithClause },
  ctx = defaultDb,
): ItemWithRelations | null {
  const row = ctx
    .select({
      id: itemsTable.id,
      collectionName: itemsTable.collection,
      props: itemsTable.props,
      locale: itemsTable.locale,
      content: itemsTable.content,
      changedAt: itemsTable.changedAt,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, id))
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
    ...props,
    content: Array.isArray(row.content) ? row.content : undefined,
    links: [],
  };

  const includes = options?.include?.filter((i) => i !== "content") ?? [];
  if (includes.length > 0) {
    resolveIncludes([item], includes, ctx);
  }

  if (options?.with && Object.keys(options.with).length > 0) {
    resolveRelations([item], options.with, findItems, ctx);
  }

  return item;
}
