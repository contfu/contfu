import { getItemAssetsQuery, getItemByIdQuery } from "$lib/remote/items.remote";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

const CANDIDATE_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

export const load: PageLoad = async ({ params }) => {
  const [item, assets] = await Promise.all([
    getItemByIdQuery(params.id),
    getItemAssetsQuery(params.id),
  ]);

  if (!item) {
    error(404, "Item not found");
  }

  const assetIdSet = new Set(assets.map((a) => a.id));

  const candidateIds = new Set<string>();
  for (const val of Object.values(item.props)) {
    if (typeof val === "string") {
      candidateIds.add(val);
    } else if (Array.isArray(val)) {
      for (const elem of val) {
        if (typeof elem === "string") candidateIds.add(elem);
      }
    }
  }

  const idsToCheck = [...candidateIds].filter(
    (v) =>
      !v.startsWith("http://") &&
      !v.startsWith("https://") &&
      !assetIdSet.has(v) &&
      CANDIDATE_ID_RE.test(v),
  );

  const lookupResults = await Promise.all(
    idsToCheck.map((id) =>
      getItemByIdQuery(id)
        .then((found) => (found ? ([id, found] as const) : null))
        .catch(() => null),
    ),
  );

  const linkedItems = Object.fromEntries(
    lookupResults.filter(
      (r): r is readonly [string, NonNullable<Awaited<ReturnType<typeof getItemByIdQuery>>>] =>
        r !== null,
    ),
  );

  return {
    item,
    assets,
    linkedItems,
  };
};
