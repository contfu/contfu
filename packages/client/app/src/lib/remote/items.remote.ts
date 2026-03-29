import { query } from "$app/server";
import { getAssetsByItem, getItemsByIds, queryItems, type QueryItemsInput } from "@contfu/client";
import * as v from "valibot";

const propFilterSchema = v.object({
  key: v.pipe(v.string(), v.minLength(1)),
  op: v.picklist(["eq", "contains"]),
  value: v.union([v.string(), v.number(), v.boolean()]),
});

const queryItemsInputSchema = v.object({
  collection: v.optional(v.string()),
  changedAtFrom: v.optional(v.number()),
  changedAtTo: v.optional(v.number()),
  propFilters: v.optional(v.array(propFilterSchema)),
  sortField: v.optional(v.picklist(["changedAt", "collection"])),
  sortDirection: v.optional(v.picklist(["asc", "desc"])),
  page: v.optional(v.number()),
  pageSize: v.optional(v.number()),
});

export const getItemsQuery = query(queryItemsInputSchema, (input) => {
  return queryItems(input as QueryItemsInput);
});

export const getItemByIdQuery = query.batch(v.pipe(v.string(), v.minLength(1)), (ids) => {
  const items = getItemsByIds({ ids });
  return (id) => items.find((item) => item.id === id) ?? null;
});

export const getItemAssetsQuery = query(v.pipe(v.string(), v.minLength(1)), (id) => {
  return getAssetsByItem(id);
});
