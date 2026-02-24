import { json } from "@sveltejs/kit";
import { findItems } from "contfu/src/features/items/findItems";
import { deserializeQueryParams } from "contfu/src/infra/http/query-client";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const options = deserializeQueryParams(url.searchParams);
  const result = await findItems(options);
  return json(result);
};
