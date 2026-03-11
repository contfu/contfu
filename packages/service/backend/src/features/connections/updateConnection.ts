import { Effect } from "effect";
import { eq } from "drizzle-orm";
import type { UpdateConnectionInput } from "../../domain/types";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { connectionTable } from "../../infra/db/schema";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const updateConnection = (id: number, input: UpdateConnectionInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    // Fetch the row first to get userId for crypto key derivation
    const [existing] = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ userId: connectionTable.userId })
          .from(connectionTable)
          .where(eq(connectionTable.id, id))
          .limit(1),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!existing) return undefined;

    const encryptedCredentials =
      input.credentials !== undefined
        ? input.skipCredentialsEncryption
          ? input.credentials
          : yield* cryptoService.encryptCredentials(existing.userId, input.credentials)
        : undefined;

    const encryptedWebhookSecret =
      input.webhookSecret !== undefined
        ? yield* cryptoService.encryptCredentials(existing.userId, input.webhookSecret)
        : undefined;

    const updates = {
      name: input.name,
      includeRef: input.includeRef,
      credentials: encryptedCredentials,
      webhookSecret: encryptedWebhookSecret,
      updatedAt: new Date(),
    };

    // Remove undefined keys to avoid overwriting with undefined
    const setValues = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined),
    );

    const [updated] = yield* Effect.tryPromise({
      try: () =>
        db.update(connectionTable).set(setValues).where(eq(connectionTable.id, id)).returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    if (!updated) return undefined;

    return mapToBackendConnection(updated);
  }).pipe(Effect.withSpan("connections.update", { attributes: { connectionId: id } }));
