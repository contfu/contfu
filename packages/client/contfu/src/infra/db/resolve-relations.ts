import type { ItemWithRelations, WithClause } from "../../domain/query-types";
import { db as defaultDb } from "./db";

const MAX_DEPTH = 3;

type FindItemsFn = (
  options: { filter?: string; limit?: number; include?: string[]; with?: WithClause },
  ctx?: any,
) => { data: ItemWithRelations[] };

export function resolveRelations(
  items: ItemWithRelations[],
  withClause: WithClause,
  findItems: FindItemsFn,
  ctx = defaultDb,
  depth = 0,
): void {
  if (items.length === 0 || depth >= MAX_DEPTH) return;

  for (const [relationName, relationDef] of Object.entries(withClause)) {
    for (const item of items) {
      const resolvedFilter = substitutePlaceholders(relationDef.filter, item);

      const result = findItems(
        {
          filter: resolvedFilter,
          limit: relationDef.limit,
          include: relationDef.include,
          with: depth + 1 < MAX_DEPTH ? relationDef.with : undefined,
        },
        ctx,
      );

      if (!item.relations) item.relations = {};
      item.relations[relationName] = result.data;
    }
  }
}

function substitutePlaceholders(filter: string, item: ItemWithRelations): string {
  return filter.replace(/:(\w+(?:\.\w+)*)/g, (_match, path: string) => {
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
