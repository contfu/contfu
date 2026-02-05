import { db } from "../../infra/db/db";
import { incidentTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";

/**
 * Get count of unresolved incidents for a user.
 */
export async function getUnresolvedIncidentCount(userId: number): Promise<number> {
  const results = await db
    .select({ id: incidentTable.id })
    .from(incidentTable)
    .where(and(eq(incidentTable.userId, userId), eq(incidentTable.resolved, false)));

  return results.length;
}
