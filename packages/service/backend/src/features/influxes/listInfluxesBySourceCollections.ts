import { Effect } from "effect";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { influxTable } from "../../infra/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { unpack } from "msgpackr";
import type { Filter } from "@contfu/svc-core";

export interface InfluxForWebhook {
  sourceCollectionId: number;
  collectionId: number;
  filters: Filter[];
  includeRef: boolean;
}

/**
 * List influxes for given source collections with unpacked filters.
 * Used by webhook handlers that need to apply filters to incoming items.
 */
export const listInfluxesBySourceCollections = (userId: number, sourceCollectionIds: number[]) =>
  Effect.gen(function* () {
    if (sourceCollectionIds.length === 0) {
      return [] as InfluxForWebhook[];
    }

    const { db } = yield* Database;

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select({
            sourceCollectionId: influxTable.sourceCollectionId,
            collectionId: influxTable.collectionId,
            filters: influxTable.filters,
            includeRef: influxTable.includeRef,
          })
          .from(influxTable)
          .where(
            and(
              eq(influxTable.userId, userId),
              inArray(influxTable.sourceCollectionId, sourceCollectionIds),
            ),
          ),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return results.map((r) => ({
      sourceCollectionId: r.sourceCollectionId,
      collectionId: r.collectionId,
      filters: r.filters ? (unpack(r.filters) as Filter[]) : [],
      includeRef: r.includeRef,
    })) satisfies InfluxForWebhook[];
  }).pipe(
    Effect.withSpan("influxes.listBySourceCollections", {
      attributes: { userId, sourceCollectionIds },
    }),
  );
