import { query } from "$app/server";
import { getUserId } from "$lib/server/auth/user";
import { db } from "$lib/server/db/db";
import {
  collectionTable,
  connectionTable,
  consumerTable,
  sourceTable,
} from "$lib/server/db/schema";
import { eq, sql } from "drizzle-orm";

export type DashboardStats = {
  sourceCount: number;
  collectionCount: number;
  totalItemCount: number;
  consumerCount: number;
  connectionCount: number;
};

/**
 * Get aggregated dashboard statistics for the current user.
 * Returns counts for sources, collections, total items, consumers, and connections.
 */
export const getDashboardStats = query(async (): Promise<DashboardStats> => {
  const userId = getUserId();

  // Run all count queries in parallel for better performance
  const [sourceResult, collectionResult, consumerResult, connectionResult] = await Promise.all([
    // Count sources
    db
      .select({ count: sql<number>`count(*)` })
      .from(sourceTable)
      .where(eq(sourceTable.userId, userId)),

    // Count collections and sum item counts (itemIds buffer length / 4 bytes per item ID)
    db
      .select({
        count: sql<number>`count(*)`,
        totalItems: sql<number>`coalesce(sum(length(${collectionTable.itemIds}) / 4), 0)`,
      })
      .from(collectionTable)
      .where(eq(collectionTable.userId, userId)),

    // Count consumers
    db
      .select({ count: sql<number>`count(*)` })
      .from(consumerTable)
      .where(eq(consumerTable.userId, userId)),

    // Count connections
    db
      .select({ count: sql<number>`count(*)` })
      .from(connectionTable)
      .where(eq(connectionTable.userId, userId)),
  ]);

  return {
    sourceCount: sourceResult[0]?.count ?? 0,
    collectionCount: collectionResult[0]?.count ?? 0,
    totalItemCount: collectionResult[0]?.totalItems ?? 0,
    consumerCount: consumerResult[0]?.count ?? 0,
    connectionCount: connectionResult[0]?.count ?? 0,
  };
});
