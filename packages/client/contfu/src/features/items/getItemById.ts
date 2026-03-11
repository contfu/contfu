import { eq } from "drizzle-orm";
import { db as defaultDb } from "../../infra/db/db";
import { itemsTable } from "../../infra/db/schema";
import { decodeId, encodeId } from "../../infra/ids";
import { resolveIncludes } from "../../infra/db/resolve-includes";
import { resolveRelations } from "../../infra/db/resolve-relations";
import { findItems } from "./findItems";
import type { IncludeOption, ItemWithRelations, WithClause } from "../../domain/query-types";

export function getItemById(
  id: string,
  options?: { include?: IncludeOption[]; with?: WithClause },
  ctx = defaultDb,
): ItemWithRelations | null {
  const row = ctx
    .select({
      id: itemsTable.id,
      connectionType: itemsTable.connectionType,
      ref: itemsTable.ref,
      collectionName: itemsTable.collection,
      props: itemsTable.props,
      content: itemsTable.content,
      changedAt: itemsTable.changedAt,
    })
    .from(itemsTable)
    .where(eq(itemsTable.id, decodeId(id)))
    .get();

  if (!row) return null;

  const props = row.props;
  const item: ItemWithRelations = {
    id: encodeId(row.id),
    connectionType: row.connectionType,
    ref: row.ref,
    collection: row.collectionName,
    props: (props && typeof props === "object" ? props : {}) as Record<string, unknown>,
    changedAt: row.changedAt,
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
