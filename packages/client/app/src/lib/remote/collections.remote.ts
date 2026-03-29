import { query } from "$app/server";
import {
  generateTypes,
  getCollectionSchemaByName,
  listCollections,
  queryItems,
  type QueryItemsInput,
} from "@contfu/client";
import {
  generateConsumerTypes,
  type CollectionSchema,
  type TypeGenerationInput,
} from "@contfu/core";
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

export const getCollectionsQuery = query(() => {
  return listCollections();
});

export type CollectionSchemaEntry = {
  name: string;
  schema: CollectionSchema | null;
};

export const getCollectionSchemasQuery = query((): CollectionSchemaEntry[] => {
  const collections = listCollections();

  return collections.map(({ name }) => ({
    name,
    schema: getCollectionSchemaByName(name),
  }));
});

export const getCombinedCollectionTypesQuery = query((): string => {
  const collections = listCollections();

  const inputs: TypeGenerationInput[] = [];
  for (const col of collections) {
    const schema = getCollectionSchemaByName(col.name);
    if (schema) {
      inputs.push({ name: col.name, displayName: col.displayName, schema });
    }
  }

  if (inputs.length === 0) return "";
  return generateConsumerTypes(inputs);
});

export const getCollectionDetailQuery = query(
  v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    input: v.optional(queryItemsInputSchema),
  }),
  async ({ name, input }) => {
    const collections = listCollections();
    const collection = collections.find((entry) => entry.name === name) ?? null;

    const mergedInput: QueryItemsInput = {
      ...input,
      collection: name,
    };

    const [result, schema] = await Promise.all([
      queryItems(mergedInput),
      getCollectionSchemaByName(name),
    ]);

    const typeString = schema != null ? generateTypes({ [name]: schema }) : null;

    return {
      collection,
      result,
      typeString,
    };
  },
);
