import { Effect } from "effect";
import { and, eq, desc } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { unpack } from "msgpackr";
import { IncidentType } from "@contfu/svc-core";
import type { BackendIncidentWithDetails } from "../../domain/types";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { incidentTable, flowTable, collectionTable } from "../../infra/db/schema";

const sourceCollection = alias(collectionTable, "sourceCollection");
const targetCollection = alias(collectionTable, "targetCollection");

/**
 * List all incidents for a user, optionally filtered by resolved status.
 * Returns most recent first.
 */
export const listIncidents = (userId: number, options?: { resolved?: boolean }) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    let query = db
      .select({
        id: incidentTable.id,
        flowId: incidentTable.flowId,
        type: incidentTable.type,
        message: incidentTable.message,
        details: incidentTable.details,
        resolved: incidentTable.resolved,
        createdAt: incidentTable.createdAt,
        resolvedAt: incidentTable.resolvedAt,
        sourceCollectionId: flowTable.sourceId,
        sourceCollectionName: sourceCollection.displayName,
        targetCollectionId: flowTable.targetId,
        targetCollectionName: targetCollection.displayName,
      })
      .from(incidentTable)
      .innerJoin(
        flowTable,
        and(eq(incidentTable.flowId, flowTable.id), eq(incidentTable.userId, flowTable.userId)),
      )
      .innerJoin(
        sourceCollection,
        and(
          eq(flowTable.sourceId, sourceCollection.id),
          eq(flowTable.userId, sourceCollection.userId),
        ),
      )
      .innerJoin(
        targetCollection,
        and(
          eq(flowTable.targetId, targetCollection.id),
          eq(flowTable.userId, targetCollection.userId),
        ),
      )
      .where(eq(incidentTable.userId, userId))
      .orderBy(desc(incidentTable.createdAt))
      .$dynamic();

    if (options?.resolved !== undefined) {
      query = query.where(eq(incidentTable.resolved, options.resolved));
    }

    const results = yield* Effect.tryPromise({
      try: () => query,
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return results.map(
      (r) =>
        ({
          id: r.id,
          flowId: r.flowId,
          sourceCollectionId: r.sourceCollectionId,
          sourceCollectionName: r.sourceCollectionName,
          targetCollectionId: r.targetCollectionId,
          targetCollectionName: r.targetCollectionName,
          type: Number(r.type) as IncidentType,
          message: r.message,
          details: r.details ? (unpack(r.details) as Record<string, unknown>) : null,
          resolved: r.resolved,
          createdAt: r.createdAt,
          resolvedAt: r.resolvedAt,
        }) satisfies BackendIncidentWithDetails,
    );
  }).pipe(Effect.withSpan("incidents.list", { attributes: { userId } }));
