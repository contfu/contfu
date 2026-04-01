import { getCollectionsQuery } from "$lib/remote/collections.remote";
import type { PageLoad } from "./$types";

export const load: PageLoad = async () => {
  const collections = await getCollectionsQuery();
  return { collections };
};
