import { eq, inArray } from "drizzle-orm";
import type { IncludeOption, PlainDateOutput, WithClause } from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";
import { db, type DbCtx } from "./db";
import { internalLinkTable } from "./schema";

const MAX_DEPTH = 3;

type FindItemsFn = (
  options: {
    filter?: string;
    limit?: number;
    include?: IncludeOption[];
    with?: WithClause;
    includeDeleted?: boolean;
    onlyDeleted?: boolean;
    plainDatesAs?: PlainDateOutput;
  },
  ctx?: any,
) => ItemWithRelations[];

export function resolveRelations(
  items: ItemWithRelations[],
  withClause: WithClause,
  findItems: FindItemsFn,
  ctx = db,
  depth = 0,
  ancestors: ItemWithRelations[] = [],
  plainDatesAs?: PlainDateOutput,
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
          includeDeleted: relationDef.includeDeleted,
          onlyDeleted: relationDef.onlyDeleted,
          plainDatesAs,
        },
        ctx,
      );

      item[relationName] = relationDef.single ? (result[0] ?? null) : result;
    }
  }
}

function resolveLinkId(linkId: number, ctx: DbCtx): number | null {
  const row = ctx
    .select({ to: internalLinkTable.to })
    .from(internalLinkTable)
    .where(eq(internalLinkTable.id, linkId))
    .get();
  return row?.to ?? null;
}

function resolveLinkIds(linkIds: number[], ctx: DbCtx): number[] {
  if (linkIds.length === 0) return [];
  const rows = ctx
    .select({ id: internalLinkTable.id, to: internalLinkTable.to })
    .from(internalLinkTable)
    .where(inArray(internalLinkTable.id, linkIds))
    .all();
  const idMap = new Map<number, number>();
  for (const row of rows) idMap.set(row.id, row.to);
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

    if (path === "$id") return String(item.$id);
    if (path === "$collection") return `"${item.$collection}"`;
    if (path === "$changedAt") return String(item.$changedAt);
    if (path === "$deletedAt") return item.$deletedAt == null ? "null" : String(item.$deletedAt);

    if (value === null || value === undefined) return "null";

    if (typeof value === "number") {
      const resolved = resolveLinkId(value, ctx);
      return resolved !== null ? String(resolved) : String(value);
    }

    if (Array.isArray(value)) {
      const nums = value.filter((v): v is number => typeof v === "number");
      const resolved = resolveLinkIds(nums, ctx);
      return JSON.stringify(resolved);
    }

    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  });
}
