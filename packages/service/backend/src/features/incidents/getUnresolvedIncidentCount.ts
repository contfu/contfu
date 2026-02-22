import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { incidentTable } from "../../infra/db/schema";

/**
 * Get count of unresolved incidents for a user.
 */
export const getUnresolvedIncidentCount = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const results = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: incidentTable.id })
          .from(incidentTable)
          .where(and(eq(incidentTable.userId, userId), eq(incidentTable.resolved, false))),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return results.length;
  }).pipe(Effect.withSpan("incidents.getUnresolvedCount", { attributes: { userId } }));
