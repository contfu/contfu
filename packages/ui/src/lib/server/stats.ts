import { countFiles, countCollections, countItems } from "@contfu/contfu";

export type DashboardStats = {
  itemCount: number;
  collectionCount: number;
  fileCount: number;
};

/**
 * Get aggregated dashboard statistics for the local database.
 * Returns counts for items (pages), unique collections, and files.
 */
export function getDashboardStats(): DashboardStats {
  const itemCount = countItems();
  const collectionCount = countCollections();
  const fileCount = countFiles();

  return { itemCount, collectionCount, fileCount };
}
