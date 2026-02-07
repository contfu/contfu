import { db } from "../../infra/db/db";
import { influxTable, sourceCollectionTable, sourceTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { CollectionSchema, Filter, InfluxWithDetails } from "@contfu/core";

/**
 * List all influxes for a collection with source details.
 */
export async function listInfluxes(
  userId: number,
  collectionId: number,
): Promise<InfluxWithDetails[]> {
  const results = await db
    .select({
      id: influxTable.id,
      sourceCollectionId: influxTable.sourceCollectionId,
      schema: influxTable.schema,
      filters: influxTable.filters,
      includeRef: influxTable.includeRef,
      createdAt: influxTable.createdAt,
      sourceCollectionName: sourceCollectionTable.name,
      sourceCollectionDisplayName: sourceCollectionTable.displayName,
      sourceCollectionRef: sourceCollectionTable.ref,
      sourceId: sourceCollectionTable.sourceId,
      sourceName: sourceTable.name,
      sourceType: sourceTable.type,
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

  return results.map((r) => ({
    id: r.id,
    sourceCollectionId: r.sourceCollectionId,
    sourceCollectionName: r.sourceCollectionDisplayName || r.sourceCollectionName,
    sourceCollectionRef: r.sourceCollectionRef ? r.sourceCollectionRef.toString("utf-8") : null,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    sourceType: r.sourceType,
    schema: r.schema ? (unpack(r.schema) as CollectionSchema) : null,
    filters: r.filters ? (unpack(r.filters) as Filter[]) : null,
    includeRef: r.includeRef,
    createdAt: r.createdAt,
  }));
}
