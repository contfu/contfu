import { parseItemQueryFromUrl } from "$lib/query/item-query";
import { getCollectionsQuery } from "$lib/remote/collections.remote";
import { getItemsQuery } from "$lib/remote/items.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ url }) => {
  const query = parseItemQueryFromUrl(url);
  const [collections, result] = await Promise.all([getCollectionsQuery(), getItemsQuery(query)]);

  return {
    query,
    collections,
    result,
  };
};
