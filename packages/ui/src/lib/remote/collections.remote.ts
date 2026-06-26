import { query } from "$app/server";
import { fetchFromServer } from "../server/proxy";
import type { CollectionSchema } from "@contfu/core";
import * as v from "valibot";
import { queryItemsInputSchema, queryItemsSearchParams } from "./query-items";

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
    const params = queryItemsSearchParams(input);

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
