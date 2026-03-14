import { Effect } from "effect";
import { inArray } from "drizzle-orm";
import type { BackendFlow, CreateFlowInput } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError, NotFoundError, QuotaError, ValidationError } from "../../effect/errors";
import { collectionTable, flowTable, currentUserIdSql } from "../../infra/db/schema";
import { checkQuota, incrementCount } from "../../infra/nats/quota-kv";
import { unpack } from "msgpackr";
import type { Flow } from "../../infra/db/schema";

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
 * Create a new flow between two collections.
 * Validates that both collections exist (and belong to the user via RLS),
 * and that the new edge would not create a cycle in the DAG.
 */
export const createFlow = (userId: number, input: CreateFlowInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const quota = yield* Effect.promise(() => checkQuota(userId, "flows"));
    if (!quota.allowed) {
      yield* Effect.fail(
        new QuotaError({
          resource: "flows",
          current: quota.current,
          max: quota.max,
        }),
      );
    }

    if (input.sourceId === input.targetId) {
      return yield* Effect.fail(
        new ValidationError({
          field: "sourceId",
          message: "Source and target collections must be different",
        }),
      );
    }

    // Validate both collections exist in a single query
    const collections = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: collectionTable.id })
          .from(collectionTable)
          .where(inArray(collectionTable.id, [input.sourceId, input.targetId])),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    const foundIds = new Set(collections.map((c) => c.id));

    if (!foundIds.has(input.sourceId)) {
      return yield* Effect.fail(new NotFoundError({ entity: "collection", id: input.sourceId }));
    }
    if (!foundIds.has(input.targetId)) {
      return yield* Effect.fail(new NotFoundError({ entity: "collection", id: input.targetId }));
    }

    // DAG cycle detection: BFS from targetId following existing flow edges.
    // Fetch all user flows in a single query (RLS scopes to current user).
    const allFlows = yield* Effect.tryPromise({
      try: () =>
        db.select({ sourceId: flowTable.sourceId, targetId: flowTable.targetId }).from(flowTable),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // Build adjacency list: source -> [targets]
    const adjacency = new Map<number, number[]>();
    for (const f of allFlows) {
      const targets = adjacency.get(f.sourceId);
      if (targets) targets.push(f.targetId);
      else adjacency.set(f.sourceId, [f.targetId]);
    }

    // BFS from targetId: if sourceId is reachable, adding sourceId->targetId creates a cycle
    const visited = new Set<number>();
    const queue: number[] = [input.targetId];
    let hasCycle = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === input.sourceId) {
        hasCycle = true;
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const downstream = adjacency.get(current);
      if (downstream) {
        for (const t of downstream) {
          if (!visited.has(t)) queue.push(t);
        }
      }
    }

    if (hasCycle) {
      return yield* Effect.fail(
        new ValidationError({
          field: "targetId",
          message: "Adding this flow would create a cycle in the DAG",
        }),
      );
    }

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(flowTable)
          .values({
            userId: currentUserIdSql,
            sourceId: input.sourceId,
            targetId: input.targetId,
            schema: input.schema ?? null,
            mappings: input.mappings ?? null,
            filters: input.filters ?? null,
            includeRef: input.includeRef ?? true,
          })
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    yield* Effect.promise(() => incrementCount(userId, "flows"));

    return mapToBackendFlow(inserted);
  }).pipe(Effect.withSpan("flows.create", { attributes: { userId } }));
