import { db } from "../../infra/db/db";
import { collectionMappingTable, type CollectionMapping } from "../../infra/db/schema";
import type { Filter } from "@contfu/core";

export interface AddSourceCollectionMappingInput {
  collectionId: number;
  sourceCollectionId: number;
  filters?: Filter[];
}

export interface CollectionMappingResult {
  userId: number;
  collectionId: number;
  sourceCollectionId: number;
  filters: Filter[] | null;
  createdAt: number;
}

function mapToResult(mapping: CollectionMapping): CollectionMappingResult {
  return {
    userId: mapping.userId,
    collectionId: mapping.collectionId,
    sourceCollectionId: mapping.sourceCollectionId,
    filters: mapping.filters ? JSON.parse(mapping.filters) : null,
    createdAt: mapping.createdAt,
  };
}

/**
 * Add a source collection to an aggregation collection with optional filters.
 */
export async function addSourceCollectionMapping(
  userId: number,
  input: AddSourceCollectionMappingInput,
): Promise<CollectionMappingResult> {
  const [inserted] = await db
    .insert(collectionMappingTable)
    .values({
      userId,
      collectionId: input.collectionId,
      sourceCollectionId: input.sourceCollectionId,
      filters: input.filters ? JSON.stringify(input.filters) : null,
    })
    .returning();

  return mapToResult(inserted);
}
