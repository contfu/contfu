import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { integrationTable } from "../../infra/db/schema";
import { mapToBackendIntegration } from "./mapToBackendIntegration";

export const listIntegrations = (userId: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const rows = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(integrationTable)
          .where(eq(integrationTable.userId, userId))
          .orderBy(integrationTable.createdAt),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return rows.map(mapToBackendIntegration);
  }).pipe(Effect.withSpan("integrations.list", { attributes: { userId } }));
