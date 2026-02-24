import { query } from "$app/server";
import {
  generateTypes,
  getCollectionSchema,
  listCollections,
  queryItems,
  type QueryItemsInput,
} from "contfu";
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
  return listCollections();
});

export const getCollectionDetailQuery = query(
  v.object({
    name: v.pipe(v.string(), v.minLength(1)),
    input: v.optional(queryItemsInputSchema),
  }),
  async ({ name, input }) => {
    const collections = await listCollections();
    const collection = collections.find((entry) => entry.name === name) ?? null;

    const mergedInput: QueryItemsInput = {
      ...input,
      collection: name,
    };

    const [result, schema] = await Promise.all([
      queryItems(mergedInput),
      getCollectionSchema(name),
    ]);

    const typeString = schema != null ? generateTypes({ [name]: schema }) : null;

    return {
      collection,
      result,
      typeString,
    };
  },
);
