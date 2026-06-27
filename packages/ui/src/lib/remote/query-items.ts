import * as v from "valibot";

const propFilterSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  op: v.picklist(["eq", "contains"]),
  value: v.union([v.string(), v.number(), v.boolean()]),
});

export const queryItemsInputSchema = v.object({
  collection: v.optional(v.string()),
  changedAtFrom: v.optional(v.number()),
  changedAtTo: v.optional(v.number()),
  propFilters: v.optional(v.array(propFilterSchema)),
  sortField: v.optional(v.picklist(["changedAt", "collection"])),
  sortDirection: v.optional(v.picklist(["asc", "desc"])),
  page: v.optional(v.number()),
  pageSize: v.optional(v.number()),
});

type QueryItemsInput = v.InferOutput<typeof queryItemsInputSchema>;

function setParam(params: URLSearchParams, name: string, value: string | number | undefined) {
  if (value !== undefined) params.set(name, String(value));
}

export function queryItemsSearchParams(
  input?: QueryItemsInput,
  options: { includeCollection?: boolean } = {},
): URLSearchParams {
  const params = new URLSearchParams();
  if (options.includeCollection) setParam(params, "collection", input?.collection);
  setParam(params, "changedAtFrom", input?.changedAtFrom);
  setParam(params, "changedAtTo", input?.changedAtTo);
  setParam(params, "sortField", input?.sortField);
  setParam(params, "sortDirection", input?.sortDirection);
  setParam(params, "page", input?.page);
  setParam(params, "pageSize", input?.pageSize);
  if (input?.propFilters?.length) params.set("propFilters", JSON.stringify(input.propFilters));
  return params;
}
