import { db } from "../../infra/db/db";
import { collectionMappingTable } from "../../infra/db/schema";
import { and, eq } from "drizzle-orm";
import type { Filter } from "@contfu/core";

export interface UpdateSourceCollectionMappingInput {
  collectionId: number;
  sourceCollectionId: number;
  filters?: Filter[] | null;
}

/**
 * Update a source collection mapping (e.g., to change filters).
 * Returns true if the mapping was updated, false if it doesn't exist.
 */
export async function updateSourceCollectionMapping(
  userId: number,
  input: UpdateSourceCollectionMappingInput,
): Promise<boolean> {
  const [updated] = await db
    .update(collectionMappingTable)
    .set({
      filters: input.filters ? JSON.stringify(input.filters) : null,
    })
    .where(
      and(
        eq(collectionMappingTable.userId, userId),
        eq(collectionMappingTable.collectionId, input.collectionId),
        eq(collectionMappingTable.sourceCollectionId, input.sourceCollectionId),
      ),
    )
    .returning({ userId: collectionMappingTable.userId });

  return !!updated;
}
