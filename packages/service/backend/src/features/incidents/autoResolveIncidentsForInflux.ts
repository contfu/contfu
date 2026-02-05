import { db } from "../../infra/db/db";
import { incidentTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Auto-resolve all incidents for an influx (called when schema becomes compatible again).
 * Returns the number of incidents resolved.
 */
export async function autoResolveIncidentsForInflux(
  userId: number,
  influxId: number,
): Promise<number> {
  const result = await db
    .delete(incidentTable)
    .where(
      and(
        eq(incidentTable.userId, userId),
        eq(incidentTable.influxId, influxId),
        eq(incidentTable.resolved, false),
      ),
    )
    .returning({ id: incidentTable.id });

  return result.length;
}
