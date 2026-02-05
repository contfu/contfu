import { db } from "../../infra/db/db";
import { incidentTable } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";

/**
 * Mark an incident as resolved and delete it (per design: delete after resolution).
 * Returns true if the incident was found and deleted.
 */
export async function resolveIncident(userId: number, id: number): Promise<boolean> {
  // First mark as resolved (in case we want to change deletion behavior later)
  await db
    .update(incidentTable)
    .set({
      resolved: true,
      resolvedAt: sql`(unixepoch())`,
    })
    .where(and(eq(incidentTable.userId, userId), eq(incidentTable.id, id)));

  // Then delete
  const result = await db
    .delete(incidentTable)
    .where(and(eq(incidentTable.userId, userId), eq(incidentTable.id, id)))
    .returning({ id: incidentTable.id });

  return result.length > 0;
}
