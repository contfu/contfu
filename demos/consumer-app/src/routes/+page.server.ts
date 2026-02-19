import type { PageServerLoad } from "./$types.js";
import { getAllArticles } from "$lib/state.svelte.js";
import { getSyncStatus, getSyncUrl } from "$lib/sync.js";

export const load: PageServerLoad = async () => {
  return {
    articles: getAllArticles(),
    syncUrl: getSyncUrl(),
    syncStatus: getSyncStatus(),
  };
};
