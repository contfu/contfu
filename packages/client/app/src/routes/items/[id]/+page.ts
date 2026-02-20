import { getItemByIdQuery } from "$lib/remote/items.remote";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ params }) => {
  const item = await getItemByIdQuery({ id: params.id });

  if (!item) {
    error(404, "Item not found");
  }

  return {
    item,
  };
};
