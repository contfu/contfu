import { db } from "../../infra/db/db";
import { collectionTable, influxTable, connectionTable } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import type { Collection } from "./listCollections";

/**
 * Get a single Collection by ID.
 */
export async function getCollection(
  userId: number,
  collectionId: number,
): Promise<Collection | null> {
  const [collection] = await db
    .select()
    .from(collectionTable)
    .where(and(eq(collectionTable.userId, userId), eq(collectionTable.id, collectionId)))
    .limit(1);

  if (!collection) return null;

  // Get influx count
  const [influxCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(influxTable)
    .where(and(eq(influxTable.userId, userId), eq(influxTable.collectionId, collectionId)));

  // Get connection count
  const [connectionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(connectionTable)
    .where(and(eq(connectionTable.userId, userId), eq(connectionTable.collectionId, collectionId)));

  return {
    id: collection.id,
    userId: collection.userId,
    name: collection.name,
    influxCount: influxCount?.count ?? 0,
    connectionCount: connectionCount?.count ?? 0,
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}
