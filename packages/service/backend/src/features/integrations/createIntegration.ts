import { Effect } from "effect";
import type { CreateIntegrationInput } from "../../domain/types";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError } from "../../effect/errors";
import { integrationTable } from "../../infra/db/schema";
import { mapToBackendIntegration } from "./mapToBackendIntegration";

export const createIntegration = (userId: number, input: CreateIntegrationInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    const encryptedCredentials = yield* cryptoService.encryptCredentials(
      userId,
      input.credentials ?? null,
    );

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(integrationTable)
          .values({
            userId,
            providerId: input.providerId,
            label: input.label,
            accountId: input.accountId ?? null,
            credentials: encryptedCredentials,
          })
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return mapToBackendIntegration(inserted);
  }).pipe(Effect.withSpan("integrations.create", { attributes: { userId } }));
