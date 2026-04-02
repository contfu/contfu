import { createItemRef } from "@contfu/core";
import type { WithClause } from "@contfu/core";
import type { TypedWithEntry, TypedWithInput } from "./query-types";

export function resolveWithFunctions(
  withVal: TypedWithInput<any, any>,
  parentLevel: number,
): WithClause {
  let entries: { [rel: string]: TypedWithEntry<any, any> };

  if (typeof withVal === "function") {
    const parentRef = createItemRef<any>(parentLevel);
    entries = withVal(parentRef);
  } else {
    entries = withVal;
  }

  const result: WithClause = {};
  for (const [name, entry] of Object.entries(entries)) {
    let filter: string | undefined;
    if (typeof entry.filter === "function") {
      const selfRef = createItemRef<any>(0);
      filter = entry.filter(selfRef);
    } else {
      filter = entry.filter;
    }

    result[name] = {
      collection: entry.collection,
      filter,
      limit: entry.limit,
      include: entry.include,
      single: entry.single,
      with: entry.with ? resolveWithFunctions(entry.with, parentLevel + 1) : undefined,
    };
  }
  return result;
}
