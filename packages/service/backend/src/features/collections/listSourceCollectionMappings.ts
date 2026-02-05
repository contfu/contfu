import { db } from "../../infra/db/db";
import { influxTable, sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { Filter } from "@contfu/core";

export interface SourceCollectionMappingWithDetails {
  id: number;
  sourceCollectionId: number;
  sourceCollectionName: string;
  sourceCollectionRef: string | null;
  sourceId: number;
  sourceName: string | null;
  sourceType: number;
  filters: Filter[] | null;
  createdAt: number;
}

/**
 * List all source collections mapped to an aggregation collection.
 * @deprecated Use listInfluxes from features/influxes instead
 */
export async function listSourceCollectionMappings(
  userId: number,
  collectionId: number,
): Promise<SourceCollectionMappingWithDetails[]> {
  const mappings = await db
    .select({
      id: influxTable.id,
      sourceCollectionId: influxTable.sourceCollectionId,
      sourceCollectionName: sourceCollectionTable.name,
      sourceCollectionDisplayName: sourceCollectionTable.displayName,
      sourceCollectionRef: sourceCollectionTable.ref,
      sourceId: sourceCollectionTable.sourceId,
      sourceName: sourceTable.name,
      sourceType: sourceTable.type,
      filters: influxTable.filters,
      createdAt: influxTable.createdAt,
    })
    .from(influxTable)
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(influxTable.userId, sourceCollectionTable.userId),
        eq(influxTable.sourceCollectionId, sourceCollectionTable.id),
      ),
    )
    .innerJoin(
      sourceTable,
      and(
        eq(sourceCollectionTable.userId, sourceTable.userId),
        eq(sourceCollectionTable.sourceId, sourceTable.id),
      ),
    )
    .where(and(eq(influxTable.userId, userId), eq(influxTable.collectionId, collectionId)));

  return mappings.map((m) => ({
    id: m.id,
    sourceCollectionId: m.sourceCollectionId,
    sourceCollectionName: m.sourceCollectionDisplayName || m.sourceCollectionName,
    sourceCollectionRef: m.sourceCollectionRef ? m.sourceCollectionRef.toString("utf-8") : null,
    sourceId: m.sourceId,
    sourceName: m.sourceName,
    sourceType: m.sourceType,
    filters: m.filters ? (unpack(m.filters) as Filter[]) : null,
    createdAt: m.createdAt,
  }));
}
