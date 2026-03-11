import { query } from "$app/server";
import { getUserId } from "$lib/server/user";
import { db } from "@contfu/svc-backend/infra/db/db";
import { connectionTable, collectionTable, flowTable } from "@contfu/svc-backend/infra/db/schema";
import { eq, sql } from "drizzle-orm";

export type DashboardStats = {
  connectionCount: number;
  collectionCount: number;
  flowCount: number;
  totalItemCount: number;
};

/**
 * Get aggregated dashboard statistics for the current user.
 * Returns counts for connections, collections, flows, and total items.
 */
export const getDashboardStats = query(async (): Promise<DashboardStats> => {
  const userId = getUserId();

  // Run all count queries in parallel for better performance
  const [connectionResult, collectionResult, flowResult] = await Promise.all([
    // Count connections
    db
      .select({ count: sql<number>`count(*)` })
      .from(connectionTable)
      .where(eq(connectionTable.userId, userId)),

    // Count collections
    db
      .select({ count: sql<number>`count(*)` })
      .from(collectionTable)
      .where(eq(collectionTable.userId, userId)),

    // Count flows
    db
      .select({ count: sql<number>`count(*)` })
      .from(flowTable)
      .where(eq(flowTable.userId, userId)),
  ]);

  return {
    connectionCount: connectionResult[0]?.count ?? 0,
    collectionCount: collectionResult[0]?.count ?? 0,
    flowCount: flowResult[0]?.count ?? 0,
    totalItemCount: 0, // Total item count no longer tracked here
  };
});
