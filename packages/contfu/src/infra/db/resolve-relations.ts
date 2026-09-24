import { isItemIdentity, PropertyType, schemaType, type ItemIdentity } from "@contfu/core";
import { and, eq, inArray } from "drizzle-orm";
import type { IncludeOption, PlainDateOutput, WithClause } from "@contfu/core";
import type { ItemWithRelations } from "../../domain/query-types";
import { db, type DbCtx } from "./db";
import { collectionsTable, internalLinkTable } from "./schema";

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

function resolveLinkId(
  linkId: number,
  owner: ItemIdentity,
  prop: string,
  ctx: DbCtx,
): ItemIdentity | null {
  const row = ctx
    .select({ to: internalLinkTable.to })
    .from(internalLinkTable)
    .where(
      and(
        eq(internalLinkTable.id, linkId),
        eq(internalLinkTable.from, owner),
        eq(internalLinkTable.prop, prop),
      ),
    )
    .get();
  return row?.to ?? null;
}

function resolveLinkIds(
  linkIds: number[],
  owner: ItemIdentity,
  prop: string,
  ctx: DbCtx,
): ItemIdentity[] {
  if (linkIds.length === 0) return [];
  const rows = ctx
    .select({ id: internalLinkTable.id, to: internalLinkTable.to })
    .from(internalLinkTable)
    .where(
      and(
        inArray(internalLinkTable.id, linkIds),
        eq(internalLinkTable.from, owner),
        eq(internalLinkTable.prop, prop),
      ),
    )
    .all();
  const idMap = new Map<number, ItemIdentity>();
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

    if (path === "$id") return JSON.stringify(item.$id);
    if (path === "$collection") return `"${item.$collection}"`;
    if (path === "$changedAt") return String(item.$changedAt);
    if (path === "$deletedAt") return item.$deletedAt == null ? "null" : String(item.$deletedAt);

    if (value === null || value === undefined) return "null";

    const schema = ctx
      .select({ schema: collectionsTable.schema })
      .from(collectionsTable)
      .where(eq(collectionsTable.name, item.$collection))
      .get()?.schema;
    const type = schema?.[path] == null ? undefined : schemaType(schema[path]);

    if (typeof value === "number") {
      // Link IDs are persisted in item props independently of the schema
      // metadata. Resolve an exact owner/property match even for legacy
      // collections whose schema omitted REF; ordinary numeric props remain
      // numeric when no matching link exists.
      const resolved = resolveLinkId(value, item.$id, path, ctx);
      if (resolved !== null) return JSON.stringify(resolved);
      if (type === PropertyType.REF) return "null";
    }

    if (isItemIdentity(value)) return JSON.stringify(value);

    if (
      Array.isArray(value) &&
      (type === PropertyType.REFS || value.some((v) => typeof v === "number"))
    ) {
      const nums = value.filter((v): v is number => typeof v === "number");
      const resolved = resolveLinkIds(nums, item.$id, path, ctx);
      if (resolved.length > 0 || type === PropertyType.REFS) return JSON.stringify(resolved);
    }

    if (typeof value === "string") return JSON.stringify(value);
    if (typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  });
}
