import { countAssets, countCollections, countItems } from "@contfu/contfu";

export type DashboardStats = {
  itemCount: number;
  collectionCount: number;
  assetCount: number;
};

/**
 * Get aggregated dashboard statistics for the local database.
 * Returns counts for items (pages), unique collections, and assets.
 */
export function getDashboardStats(): DashboardStats {
  const itemCount = countItems();
  const collectionCount = countCollections();
  const assetCount = countAssets();

  return { itemCount, collectionCount, assetCount };
}
