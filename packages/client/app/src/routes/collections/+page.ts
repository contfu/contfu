import {
  getCollectionsQuery,
  getCombinedCollectionTypesQuery,
} from "$lib/remote/collections.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const [collections, combinedTypeString] = await Promise.all([
    getCollectionsQuery(),
    getCombinedCollectionTypesQuery(),
  ]);
  return { collections, combinedTypeString };
};
