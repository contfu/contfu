import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { integrationTable } from "../../infra/db/schema";

export const deleteIntegration = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const result = yield* Effect.tryPromise({
      try: () =>
        db
          .delete(integrationTable)
          .where(and(eq(integrationTable.id, id), eq(integrationTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return result.length > 0;
  }).pipe(Effect.withSpan("integrations.delete", { attributes: { userId, integrationId: id } }));
