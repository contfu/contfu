import { db } from "../../infra/db/db";
import { collectionMappingTable, sourceCollectionTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { Filter } from "@contfu/core";

export interface SourceCollectionMappingWithDetails {
  sourceCollectionId: number;
  sourceCollectionName: string;
  sourceId: number;
  filters: Filter[] | null;
  createdAt: number;
}

/**
 * List all source collections mapped to an aggregation collection.
 */
export async function listSourceCollectionMappings(
  userId: number,
  collectionId: number,
): Promise<SourceCollectionMappingWithDetails[]> {
  const mappings = await db
    .select({
      sourceCollectionId: collectionMappingTable.sourceCollectionId,
      sourceCollectionName: sourceCollectionTable.name,
      sourceId: sourceCollectionTable.sourceId,
      filters: collectionMappingTable.filters,
      createdAt: collectionMappingTable.createdAt,
    })
    .from(collectionMappingTable)
    .innerJoin(
      sourceCollectionTable,
      and(
        eq(collectionMappingTable.userId, sourceCollectionTable.userId),
        eq(collectionMappingTable.sourceCollectionId, sourceCollectionTable.id),
      ),
    )
    .where(
      and(
        eq(collectionMappingTable.userId, userId),
        eq(collectionMappingTable.collectionId, collectionId),
      ),
    );

  return mappings.map((m) => ({
    sourceCollectionId: m.sourceCollectionId,
    sourceCollectionName: m.sourceCollectionName,
    sourceId: m.sourceId,
    filters: m.filters ? JSON.parse(m.filters) : null,
    createdAt: m.createdAt,
  }));
}
