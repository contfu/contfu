import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { integrationTable } from "../../infra/db/schema";
import { mapToBackendIntegration } from "./mapToBackendIntegration";

export const renameIntegration = (userId: number, id: number, label: string) =>
  Effect.gen(function* () {
    const { db } = yield* Database;

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db
          .update(integrationTable)
          .set({ label, updatedAt: new Date() })
          .where(and(eq(integrationTable.id, id), eq(integrationTable.userId, userId)))
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendIntegration(updated);
  }).pipe(Effect.withSpan("integrations.rename", { attributes: { userId, integrationId: id } }));
