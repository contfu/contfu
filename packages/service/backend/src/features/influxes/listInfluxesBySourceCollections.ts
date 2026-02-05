import { db } from "../../infra/db/db";
import { influxTable } from "../../infra/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { Filter } from "@contfu/core";

export interface InfluxForWebhook {
  sourceCollectionId: number;
  collectionId: number;
  filters: Filter[];
}

/**
 * List influxes for given source collections with unpacked filters.
 * Used by webhook handlers that need to apply filters to incoming items.
 */
export async function listInfluxesBySourceCollections(
  userId: number,
  sourceCollectionIds: number[],
): Promise<InfluxForWebhook[]> {
  if (sourceCollectionIds.length === 0) {
    return [];
  }

  const results = await db
    .select({
      sourceCollectionId: influxTable.sourceCollectionId,
      collectionId: influxTable.collectionId,
      filters: influxTable.filters,
    })
    .from(influxTable)
    .where(
      and(
        eq(influxTable.userId, userId),
        inArray(influxTable.sourceCollectionId, sourceCollectionIds),
      ),
    );

  return results.map((r) => ({
    sourceCollectionId: r.sourceCollectionId,
    collectionId: r.collectionId,
    filters: r.filters ? (unpack(r.filters) as Filter[]) : [],
  }));
}
