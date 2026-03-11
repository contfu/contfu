import { Effect } from "effect";
import { eq } from "drizzle-orm";
import { Database } from "../../effect/services/Database";
import { Crypto } from "../../effect/services/Crypto";
import { DatabaseError } from "../../effect/errors";
import { connectionTable, type Connection } from "../../infra/db/schema";

export type InternalConnectionWithCredentials = Omit<
  Connection,
  "credentials" | "webhookSecret"
> & {
  credentials: Buffer | null;
  webhookSecret: Buffer | null;
};

export const getConnectionWithCredentials = (id: number) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    const [row] = yield* Effect.tryPromise({
      try: () => db.select().from(connectionTable).where(eq(connectionTable.id, id)).limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!row) return undefined;

    const credentials = yield* cryptoService.decryptCredentials(row.userId, row.credentials);
    const webhookSecret = yield* cryptoService.decryptCredentials(row.userId, row.webhookSecret);

    return { ...row, credentials, webhookSecret } as InternalConnectionWithCredentials;
  }).pipe(
    Effect.withSpan("connections.getWithCredentials", {
      attributes: { connectionId: id },
    }),
  );
