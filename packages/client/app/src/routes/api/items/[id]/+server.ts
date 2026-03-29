import { error, json } from "@sveltejs/kit";
import { getItemById } from "@contfu/client/src/features/items/getItemById";
import type { IncludeOption, WithClause } from "@contfu/client/src/domain/query-types";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const include = url.searchParams.get("include");
  const withStr = url.searchParams.get("with");

  const options: { include?: IncludeOption[]; with?: WithClause } = {};

  if (include) {
    options.include = include.split(",").map((s) => s.trim()) as IncludeOption[];
  }

  if (withStr) {
    try {
      options.with = JSON.parse(withStr);
    } catch {
      error(400, "Invalid 'with' parameter — expected valid JSON");
    }
  }

  const item = await getItemById(params.id, options);
  if (!item) error(404, "Item not found");

  return json({ data: item });
};
