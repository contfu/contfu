import { getCollectionDetailQuery, getCollectionsQuery } from "$lib/remote/collections.remote";
import { parseItemQueryFromUrl } from "$lib/query/item-query";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params, url }) => {
  const query = parseItemQueryFromUrl(url, { lockedCollection: params.name });

  const [allCollections, detail] = await Promise.all([
    getCollectionsQuery(),
    getCollectionDetailQuery({
      name: params.name,
      input: query,
    }),
  ]);

  if (!detail.collection) {
    error(404, "Collection not found");
  }

  return {
    query,
    collections: allCollections,
    collection: detail.collection,
    result: detail.result,
    typeString: detail.typeString,
  };
};
