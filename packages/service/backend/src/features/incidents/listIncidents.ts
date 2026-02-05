import { db } from "../../infra/db/db";
import { incidentTable, influxTable, collectionTable, sourceCollectionTable } from "../../infra/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { unpack } from "msgpackr";
import { IncidentType, type IncidentWithDetails } from "@contfu/core";

/**
 * List all incidents for a user, optionally filtered by resolved status.
 * Returns most recent first.
 */
export async function listIncidents(
  userId: number,
  options?: { resolved?: boolean },
): Promise<IncidentWithDetails[]> {
  let query = db
    .select({
      id: incidentTable.id,
      influxId: incidentTable.influxId,
      type: incidentTable.type,
      message: incidentTable.message,
      details: incidentTable.details,
      resolved: incidentTable.resolved,
      createdAt: incidentTable.createdAt,
      resolvedAt: incidentTable.resolvedAt,
      collectionId: influxTable.collectionId,
      collectionName: collectionTable.name,
      sourceCollectionId: influxTable.sourceCollectionId,
      sourceCollectionName: sourceCollectionTable.name,
      sourceCollectionDisplayName: sourceCollectionTable.displayName,
    })
    .from(incidentTable)
    .innerJoin(
      influxTable,
      and(eq(incidentTable.userId, influxTable.userId), eq(incidentTable.influxId, influxTable.id)),
    )
    .innerJoin(
      collectionTable,
      and(
        eq(influxTable.userId, collectionTable.userId),
        eq(influxTable.collectionId, collectionTable.id),
      ),
    )
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(influxTable.userId, sourceCollectionTable.userId),
        eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
      ),
    )
    .where(eq(incidentTable.userId, userId))
    .orderBy(desc(incidentTable.createdAt))
    .$dynamic();

  if (options?.resolved !== undefined) {
    query = query.where(eq(incidentTable.resolved, options.resolved));
  }

  const results = await query;

  return results.map((r) => ({
    id: r.id,
    influxId: r.influxId,
    collectionId: r.collectionId,
    collectionName: r.collectionName,
    sourceCollectionId: r.sourceCollectionId,
    sourceCollectionName: r.sourceCollectionDisplayName || r.sourceCollectionName,
    type: Number(r.type) as IncidentType,
    message: r.message,
    details: r.details ? (unpack(r.details) as Record<string, unknown>) : null,
    resolved: r.resolved,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
  }));
}
