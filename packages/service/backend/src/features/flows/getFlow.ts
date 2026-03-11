import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { BackendFlow } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { flowTable } from "../../infra/db/schema";
import type { Flow } from "../../infra/db/schema";
import { unpack } from "msgpackr";

function mapToBackendFlow(flow: Flow): BackendFlow {
  return {
    id: flow.id,
    sourceId: flow.sourceId,
    targetId: flow.targetId,
    schema: flow.schema ? unpack(flow.schema) : null,
    mappings: flow.mappings ? unpack(flow.mappings) : null,
    filters: flow.filters ? unpack(flow.filters) : null,
    includeRef: flow.includeRef,
    createdAt: flow.createdAt,
    updatedAt: flow.updatedAt,
  };
}

/**
 * Get a single flow by ID, scoped to the current user via RLS.
 */
export const getFlow = (flowId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [flow] = yield* Effect.tryPromise({
      try: () => db.select().from(flowTable).where(eq(flowTable.id, flowId)).limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!flow) return undefined;

    return mapToBackendFlow(flow);
  }).pipe(Effect.withSpan("flows.get", { attributes: { flowId } }));
