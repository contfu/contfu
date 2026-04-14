import { query } from "$app/server";

export const getStats = query(async () => {
  const { countFiles, countCollections, countItems, countDownloadedFiles, countProcessedFiles } =
    await import("@contfu/contfu");
  const { getSyncStatus } = await import("$lib/server/sync-status");
  const itemCount = countItems();
  const collectionCount = countCollections();
  const fileCount = countFiles();
  const downloadedCount = countDownloadedFiles();
  const processedCount = countProcessedFiles();
  return {
    itemCount,
    collectionCount,
    fileCount,
    downloadedCount,
    processedCount,
    sync: getSyncStatus(),
  };
});
