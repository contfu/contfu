import type { ItemPropFilterOperator, QueryItemsInput } from "contfu";

function parseMaybeNumber(value: string | null): number | undefined {
  if (!value) return undefined;
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function parsePrimitive(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;

  const num = Number(value);
  if (!Number.isNaN(num) && value.trim() !== "") return num;

  return value;
}

export function parseItemQueryFromUrl(
  url: URL,
  options: { lockedCollection?: string } = {},
): QueryItemsInput {
  const sp = url.searchParams;

  const keys = sp.getAll("propKey");
  const ops = sp.getAll("propOp");
  const values = sp.getAll("propValue");

  const propFilters = keys
    .map((key, idx) => {
      let op: ItemPropFilterOperator | undefined;
      if (ops[idx] === "eq" || ops[idx] === "contains") {
        op = ops[idx];
      }
      const rawValue = values[idx];

      if (!key || !op || rawValue === undefined || rawValue === "") {
        return null;
      }

      return { key, op, value: parsePrimitive(rawValue) };
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  const collection = options.lockedCollection ?? sp.get("collection") ?? undefined;

  return {
    collection,
    search: sp.get("search") ?? undefined,
    changedAtFrom: parseMaybeNumber(sp.get("changedAtFrom")),
    changedAtTo: parseMaybeNumber(sp.get("changedAtTo")),
    propFilters: propFilters.length > 0 ? propFilters : undefined,
    sortField:
      sp.get("sortField") === "ref" || sp.get("sortField") === "collection"
        ? (sp.get("sortField") as "ref" | "collection")
        : sp.get("sortField") === "changedAt"
          ? "changedAt"
          : undefined,
    sortDirection: sp.get("sortDirection") === "asc" ? "asc" : sp.get("sortDirection") === "desc" ? "desc" : undefined,
    page: parseMaybeNumber(sp.get("page")),
    pageSize: parseMaybeNumber(sp.get("pageSize")),
  };
}

export function buildItemQuerySearchParams(
  input: QueryItemsInput,
  options: { lockedCollection?: string } = {},
): URLSearchParams {
  const sp = new URLSearchParams();

  if (!options.lockedCollection && input.collection) sp.set("collection", input.collection);
  if (input.search) sp.set("search", input.search);
  if (typeof input.changedAtFrom === "number") sp.set("changedAtFrom", String(input.changedAtFrom));
  if (typeof input.changedAtTo === "number") sp.set("changedAtTo", String(input.changedAtTo));
  if (input.sortField) sp.set("sortField", input.sortField);
  if (input.sortDirection) sp.set("sortDirection", input.sortDirection);
  if (typeof input.page === "number") sp.set("page", String(input.page));
  if (typeof input.pageSize === "number") sp.set("pageSize", String(input.pageSize));

  if (input.propFilters) {
    for (const filter of input.propFilters) {
      sp.append("propKey", filter.key);
      sp.append("propOp", filter.op);
      sp.append("propValue", String(filter.value));
    }
  }

  return sp;
}
