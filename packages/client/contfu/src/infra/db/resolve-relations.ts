import type { IncludeOption, ItemWithRelations, WithClause } from "../../domain/query-types";
import { db as defaultDb } from "./db";

const MAX_DEPTH = 3;

type FindItemsFn = (
  options: { filter?: string; limit?: number; include?: IncludeOption[]; with?: WithClause },
  ctx?: any,
) => { data: ItemWithRelations[] };

export function resolveRelations(
  items: ItemWithRelations[],
  withClause: WithClause,
  findItems: FindItemsFn,
  ctx = defaultDb,
  depth = 0,
  ancestors: ItemWithRelations[] = [],
): void {
  if (items.length === 0 || depth >= MAX_DEPTH) return;

  for (const [relationName, relationDef] of Object.entries(withClause)) {
    for (const item of items) {
      let filter = relationDef.filter ?? "";
      if (relationDef.collection) {
        const collectionFilter = `collection = "${relationDef.collection}"`;
        filter = filter ? `${collectionFilter} && (${filter})` : collectionFilter;
      }
      const itemAncestors = [...ancestors, item];
      const resolvedFilter = filter ? substitutePlaceholders(filter, itemAncestors) : undefined;

      const result = findItems(
        {
          filter: resolvedFilter,
          limit: relationDef.limit,
          include: relationDef.include,
          with: depth + 1 < MAX_DEPTH ? relationDef.with : undefined,
        },
        ctx,
      );

      if (!item.rels) item.rels = {};

      if (relationDef.single) {
        item.rels[relationName] = result.data[0] ?? null;
      } else {
        item.rels[relationName] = result.data;
      }
    }
  }
}

function substitutePlaceholders(filter: string, ancestors: ItemWithRelations[]): string {
  return filter.replace(/\$(\d+)\.(\w+(?:\.\w+)*)/g, (_match, levelStr: string, path: string) => {
    const level = parseInt(levelStr, 10);
    const item = ancestors[ancestors.length - level];
    if (!item) return `"$${levelStr}.${path}"`;

    if (path === "id") return `"${item.id}"`;
    if (path === "ref") return item.ref !== null ? `"${item.ref}"` : "null";
    if (path === "collection") return `"${item.collection}"`;

    if (path.startsWith("props.")) {
      const propKey = path.slice(6);
      const value = item.props[propKey];
      if (value === null || value === undefined) return "null";
      if (typeof value === "string") return `"${value}"`;
      if (typeof value === "boolean") return value ? "true" : "false";
      return String(value);
    }

    return `"${path}"`;
  });
}
