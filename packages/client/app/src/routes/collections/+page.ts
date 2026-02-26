import { getCollectionSchemasQuery, getCollectionsQuery } from "$lib/remote/collections.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const [collections, collectionSchemas] = await Promise.all([
    getCollectionsQuery(),
    getCollectionSchemasQuery(),
  ]);
  return { collections, collectionSchemas };
};
