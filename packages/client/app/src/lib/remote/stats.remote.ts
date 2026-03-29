import { query } from "$app/server";

export const getStats = query(async () => {
  const { countAssets, countCollections, countItems, countDownloadedAssets, countProcessedAssets } =
    await import("@contfu/client");
  const { getSyncStatus } = await import("$lib/server/sync-status");
  const [itemCount, collectionCount, assetCount, downloadedCount, processedCount] =
    await Promise.all([
      countItems(),
      countCollections(),
      countAssets(),
      countDownloadedAssets(),
      countProcessedAssets(),
    ]);
  return {
    itemCount,
    collectionCount,
    assetCount,
    downloadedCount,
    processedCount,
    sync: getSyncStatus(),
  };
});
