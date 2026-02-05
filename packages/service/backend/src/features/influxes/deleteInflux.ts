import { db } from "../../infra/db/db";
import { influxTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Delete an influx by ID.
 * Returns true if deleted, false if not found.
 */
export async function deleteInflux(userId: number, id: number): Promise<boolean> {
  const result = await db
    .delete(influxTable)
    .where(and(eq(influxTable.userId, userId), eq(influxTable.id, id)))
    .returning({ id: influxTable.id });

  return result.length > 0;
}
