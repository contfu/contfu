import { eq, inArray } from "drizzle-orm";
import type { IncludeOption, ItemWithRelations, WithClause } from "../../domain/query-types";
import { encodeId } from "../ids";
import { db, type DbCtx } from "./db";
import { linkTable } from "./schema";

const MAX_DEPTH = 3;

type FindItemsFn = (
  options: { filter?: string; limit?: number; include?: IncludeOption[]; with?: WithClause },
  ctx?: any,
) => { data: ItemWithRelations[] };

export function resolveRelations(
  items: ItemWithRelations[],
  withClause: WithClause,
  findItems: FindItemsFn,
  ctx = db,
  depth = 0,
  ancestors: ItemWithRelations[] = [],
): void {
  if (items.length === 0 || depth >= MAX_DEPTH) return;

  for (const [relationName, relationDef] of Object.entries(withClause)) {
    for (const item of items) {
      let filter = relationDef.filter ?? "";
      if (relationDef.collection) {
        const collectionFilter = `$collection = "${relationDef.collection}"`;
        filter = filter ? `${collectionFilter} && (${filter})` : collectionFilter;
      }
      const itemAncestors = [...ancestors, item];
      const resolvedFilter = filter
        ? substitutePlaceholders(filter, itemAncestors, ctx)
        : undefined;

      const result = findItems(
        {
          filter: resolvedFilter,
          limit: relationDef.limit,
          include: relationDef.include,
          with: depth + 1 < MAX_DEPTH ? relationDef.with : undefined,
        },
        ctx,
      );

      item[relationName] = relationDef.single ? (result.data[0] ?? null) : result.data;
    }
  }
}

function resolveLinkId(linkId: number, ctx: DbCtx): string | null {
  const row = ctx
    .select({ to: linkTable.to, internal: linkTable.internal })
    .from(linkTable)
    .where(eq(linkTable.id, linkId))
    .get();
  if (!row || !row.internal) return null;
  return encodeId(row.to);
}

function resolveLinkIds(linkIds: number[], ctx: DbCtx): string[] {
  if (linkIds.length === 0) return [];
  const rows = ctx
    .select({ id: linkTable.id, to: linkTable.to, internal: linkTable.internal })
    .from(linkTable)
    .where(inArray(linkTable.id, linkIds))
    .all();
  const idMap = new Map<number, string>();
  for (const row of rows) {
    if (row.internal) {
      idMap.set(row.id, encodeId(row.to));
    }
  }
  return linkIds.filter((id) => idMap.has(id)).map((id) => idMap.get(id)!);
}

function substitutePlaceholders(
  filter: string,
  ancestors: ItemWithRelations[],
  ctx: DbCtx,
): string {
  return filter.replace(/\$(\d+)\.(\$?\w+)/g, (_match, levelStr: string, path: string) => {
    const level = parseInt(levelStr, 10);
    const item = ancestors[ancestors.length - level];
    if (!item) return `"$${levelStr}.${path}"`;

    const value = item[path];

    if (path === "$id") return `"${item.$id}"`;
    if (path === "$ref") return item.$ref !== null ? `"${item.$ref}"` : "null";
    if (path === "$collection") return `"${item.$collection}"`;
    if (path === "$changedAt") return String(item.$changedAt);
    if (path === "$connectionType") {
      return item.$connectionType !== undefined && item.$connectionType !== null
        ? String(item.$connectionType)
        : "null";
    }

    if (value === null || value === undefined) return "null";

    if (typeof value === "number") {
      const resolved = resolveLinkId(value, ctx);
      return resolved ? `"${resolved}"` : String(value);
    }

    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "number") {
      const resolved = resolveLinkIds(value as unknown as number[], ctx);
      if (resolved.length === 0) return "null";
      if (resolved.length === 1) return `"${resolved[0]}"`;
      return resolved.map((id) => `"${id}"`).join(", ");
    }

    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "boolean") return value ? "true" : "false";
    return String(value);
  });
}
