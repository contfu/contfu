import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { incidentTable } from "../../infra/db/schema";

/**
 * Mark an incident as resolved and delete it (per design: delete after resolution).
 * Returns true if the incident was found and deleted.
 */
export const resolveIncident = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    // First mark as resolved (in case we want to change deletion behavior later)
    yield* Effect.tryPromise({
      try: () =>
        db
          .update(incidentTable)
          .set({
            resolved: true,
            resolvedAt: new Date(),
          })
          .where(and(eq(incidentTable.userId, userId), eq(incidentTable.id, id))),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    // Then delete
    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(incidentTable)
          .where(and(eq(incidentTable.userId, userId), eq(incidentTable.id, id)))
          .returning({ id: incidentTable.id }),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("incidents.resolve", { attributes: { userId, id } }));
