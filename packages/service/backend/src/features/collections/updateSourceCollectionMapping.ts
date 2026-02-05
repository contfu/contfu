import { db } from "../../infra/db/db";
import { influxTable } from "../../infra/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { pack } from "msgpackr";
import type { Filter } from "@contfu/core";

export interface UpdateSourceCollectionMappingInput {
  collectionId: number;
  sourceCollectionId: number;
  filters?: Filter[] | null;
}

/**
 * Update a source collection mapping (e.g., to change filters).
 * Returns true if the mapping was updated, false if it doesn't exist.
 * @deprecated Use updateInflux from features/influxes instead
 */
export async function updateSourceCollectionMapping(
  userId: number,
  input: UpdateSourceCollectionMappingInput,
): Promise<boolean> {
  const [updated] = await db
    .update(influxTable)
    .set({
      filters: input.filters?.length ? pack(input.filters) : null,
      updatedAt: sql`(unixepoch())`,
    })
    .where(
      and(
        eq(influxTable.userId, userId),
        eq(influxTable.collectionId, input.collectionId),
        eq(influxTable.sourceCollectionId, input.sourceCollectionId),
      ),
    )
    .returning({ userId: influxTable.userId });

  return !!updated;
}
