import { query } from "$app/server";

export const getStats = query(async () => {
  const { countAssets, countCollections, countItems } = await import("contfu");
  const [itemCount, collectionCount, assetCount] = await Promise.all([
    countItems(),
    countCollections(),
    countAssets(),
  ]);
  return { itemCount, collectionCount, assetCount };
});
