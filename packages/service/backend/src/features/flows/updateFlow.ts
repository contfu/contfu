import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { BackendFlow, UpdateFlowInput } from "../../domain/types";
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
 * Update a flow's filters, mappings, schema, or includeRef.
 */
export const updateFlow = (flowId: number, input: UpdateFlowInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.filters !== undefined) updates.filters = input.filters;
    if (input.mappings !== undefined) updates.mappings = input.mappings;
    if (input.schema !== undefined) updates.schema = input.schema;
    if (input.includeRef !== undefined) updates.includeRef = input.includeRef;

    const [updated] = yield* Effect.tryPromise({
      try: () => db.update(flowTable).set(updates).where(eq(flowTable.id, flowId)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendFlow(updated);
  }).pipe(Effect.withSpan("flows.update", { attributes: { flowId } }));
