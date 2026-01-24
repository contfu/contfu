import type { PageServerLoad } from "./$types.js";
import { getArticleBySlug } from "$lib/state.svelte.js";
import { error } from "@sveltejs/kit";

export const load: PageServerLoad = async ({ params }) => {
  const article = getArticleBySlug(params.slug);

  if (!article) {
    error(404, "Article not found");
  }

  return { article };
};
