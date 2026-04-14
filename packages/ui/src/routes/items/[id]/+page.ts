import { getItemFilesQuery, getItemByIdQuery } from "$lib/remote/items.remote";
import { error } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

const CANDIDATE_ID_RE = /^[A-Za-z0-9_-]{8,32}$/;

export const load: PageLoad = async ({ params }) => {
  const [item, files] = await Promise.all([
    getItemByIdQuery(params.id),
    getItemFilesQuery(params.id),
  ]);

  if (!item) {
    error(404, "Item not found");
  }

  const fileIdSet = new Set(files.map((a) => a.id));

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
      !fileIdSet.has(v) &&
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
    files,
    linkedItems,
  };
};
