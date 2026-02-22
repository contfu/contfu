import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { incidentTable } from "../../infra/db/schema";

/**
 * Auto-resolve all incidents for an influx (called when schema becomes compatible again).
 * Returns the number of incidents resolved.
 */
export const autoResolveIncidentsForInflux = (userId: number, influxId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(incidentTable)
          .where(
            and(
              eq(incidentTable.userId, userId),
              eq(incidentTable.influxId, influxId),
              eq(incidentTable.resolved, false),
            ),
          )
          .returning({ id: incidentTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length;
  }).pipe(Effect.withSpan("incidents.autoResolveForInflux", { attributes: { userId, influxId } }));
