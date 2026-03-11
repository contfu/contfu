import { Effect } from "effect";
import { inArray } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { flowTable } from "../../infra/db/schema";
import { unpack } from "msgpackr";
import type { Filter, MappingRule } from "@contfu/svc-core";

interface FlowForWebhook {
  flowId: number;
  sourceId: number;
  targetId: number;
  filters: Filter[];
  includeRef: boolean;
  mappings: MappingRule[] | null;
}

/**
 * List flows for given source collection IDs with unpacked filters.
 * Used by webhook handlers to determine which flows to trigger.
 */
export const listFlowsBySourceCollections = (sourceIds: number[]) =>
  Effect.gen(function* () {
    if (sourceIds.length === 0) return [] as FlowForWebhook[];

    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () => db.select().from(flowTable).where(inArray(flowTable.sourceId, sourceIds)),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return rows.map((row) => ({
      flowId: row.id,
      sourceId: row.sourceId,
      targetId: row.targetId,
      filters: row.filters ? (unpack(row.filters) as Filter[]) : [],
      includeRef: row.includeRef,
      mappings: row.mappings ? (unpack(row.mappings) as MappingRule[]) : null,
    }));
  }).pipe(Effect.withSpan("flows.listBySourceCollections"));
