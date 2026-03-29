import { json } from "@sveltejs/kit";
import { findItems } from "@contfu/client/src/features/items/findItems";
import { deserializeQueryParams } from "@contfu/client/src/infra/http/query-client";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const options = deserializeQueryParams(url.searchParams);

  // Pre-filter by collection
  const collectionFilter = `collection = "${params.name}"`;
  options.filter = options.filter ? `${collectionFilter} && (${options.filter})` : collectionFilter;

  const result = await findItems(options);
  return json(result);
};
