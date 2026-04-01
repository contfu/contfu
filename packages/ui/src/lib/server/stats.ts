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
export async function getDashboardStats(): Promise<DashboardStats> {
  const [itemCount, collectionCount, assetCount] = await Promise.all([
    countItems(),
    countCollections(),
    countAssets(),
  ]);

  return { itemCount, collectionCount, assetCount };
}
