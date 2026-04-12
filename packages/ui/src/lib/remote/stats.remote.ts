import { query } from "$app/server";

export const getStats = query(async () => {
  const { countAssets, countCollections, countItems, countDownloadedAssets, countProcessedAssets } =
    await import("@contfu/contfu");
  const { getSyncStatus } = await import("$lib/server/sync-status");
  const itemCount = countItems();
  const collectionCount = countCollections();
  const assetCount = countAssets();
  const downloadedCount = countDownloadedAssets();
  const processedCount = countProcessedAssets();
  return {
    itemCount,
    collectionCount,
    assetCount,
    downloadedCount,
    processedCount,
    sync: getSyncStatus(),
  };
});
