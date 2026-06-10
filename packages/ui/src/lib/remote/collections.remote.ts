import { query } from "$app/server";
import { fetchFromServer } from "$lib/server/proxy";
import type { CollectionSchema } from "@contfu/core";
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

export const getCollectionsQuery = query(async () => {
  const response = await fetchFromServer("/api/collections");
  if (!response.ok) {
    throw new Error(`Failed to load collections: ${response.status} ${response.statusText}`);
  }
  return response.json();
});

export type CollectionSchemaEntry = {
  name: string;
  schema: CollectionSchema | null;
};

export const getCollectionSchemasQuery = query(async (): Promise<CollectionSchemaEntry[]> => {
  const collections = (await getCollectionsQuery()) as Array<{ name: string }>;

  return collections.map(({ name }) => ({
    name,
    schema: null,
  }));
});

export const getCombinedCollectionTypesQuery = query(async (): Promise<string> => {
  const response = await fetchFromServer("/api/types");
  if (!response.ok) {
    throw new Error(`Failed to load types: ${response.status} ${response.statusText}`);
  }
  return response.text();
});

export const getCollectionDetailQuery = query(
  v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    input: v.optional(queryItemsInputSchema),
  }),
  async ({ name, input }) => {
    const params = new URLSearchParams();
    if (input?.changedAtFrom != null) params.set("changedAtFrom", String(input.changedAtFrom));
    if (input?.changedAtTo != null) params.set("changedAtTo", String(input.changedAtTo));
    if (input?.sortField) params.set("sortField", input.sortField);
    if (input?.sortDirection) params.set("sortDirection", input.sortDirection);
    if (input?.page != null) params.set("page", String(input.page));
    if (input?.pageSize != null) params.set("pageSize", String(input.pageSize));
    if (input?.propFilters?.length) params.set("propFilters", JSON.stringify(input.propFilters));

    const response = await fetchFromServer(
      `/api/collections/${encodeURIComponent(name)}${params.size ? `?${params.toString()}` : ""}`,
    );
    if (!response.ok) {
      throw new Error(
        `Failed to load collection detail: ${response.status} ${response.statusText}`,
      );
    }

    return response.json();
  },
);
