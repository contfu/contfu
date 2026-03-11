import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { incidentTable } from "../../infra/db/schema";

/**
 * Auto-resolve all incidents for a flow (called when schema becomes compatible again).
 * Returns the number of incidents resolved.
 */
export const autoResolveIncidentsForFlow = (userId: number, flowId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(incidentTable)
          .where(
            and(
              eq(incidentTable.userId, userId),
              eq(incidentTable.flowId, flowId),
              eq(incidentTable.resolved, false),
            ),
          )
          .returning({ id: incidentTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length;
  }).pipe(Effect.withSpan("incidents.autoResolveForFlow", { attributes: { userId, flowId } }));
