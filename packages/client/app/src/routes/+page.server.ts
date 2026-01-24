import type { PageServerLoad } from "./$types";
import { getDashboardStats, type DashboardStats } from "$lib/server/stats";

export const load: PageServerLoad = async () => {
  try {
    const stats = await getDashboardStats();
    return { stats, hasLoadError: false };
  } catch {
    return {
      stats: { itemCount: 0, collectionCount: 0, assetCount: 0 } as DashboardStats,
      hasLoadError: true,
    };
  }
};
