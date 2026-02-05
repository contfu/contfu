import { db } from "../../infra/db/db";
import { influxTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete an influx by collection and source collection IDs.
 * Returns true if deleted, false if not found.
 */
export async function deleteInfluxByMapping(
  userId: number,
  collectionId: number,
  sourceCollectionId: number,
): Promise<boolean> {
  const result = await db
    .delete(influxTable)
    .where(
      and(
        eq(influxTable.userId, userId),
        eq(influxTable.collectionId, collectionId),
        eq(influxTable.sourceCollectionId, sourceCollectionId),
      ),
    )
    .returning({ id: influxTable.id });

  return result.length > 0;
}
