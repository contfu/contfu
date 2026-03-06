import { Effect } from "effect";
import { and, eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { Crypto } from "../../effect/services/Crypto";
import { DatabaseError } from "../../effect/errors";
import { integrationTable, type Integration } from "../../infra/db/schema";

export type InternalIntegrationWithCredentials = Integration & {
  credentials: Buffer | null;
};

export const getIntegrationWithCredentials = (userId: number, id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    const [row] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(integrationTable)
          .where(and(eq(integrationTable.id, id), eq(integrationTable.userId, userId)))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return undefined;

    const credentials = yield* cryptoService.decryptCredentials(row.userId, row.credentials);

    return { ...row, credentials } as InternalIntegrationWithCredentials;
  }).pipe(
    Effect.withSpan("integrations.getWithCredentials", {
      attributes: { userId, integrationId: id },
    }),
  );
