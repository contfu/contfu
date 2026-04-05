import crypto from "node:crypto";
import { Effect } from "effect";
import { ConnectionType } from "@contfu/core";
import type { CreateConnectionInput } from "../../domain/types";
import { Crypto } from "../../effect/services/Crypto";
import { Database } from "../../effect/services/Database";
import { DatabaseError, QuotaError } from "../../effect/errors";
import { connectionTable, currentUserIdSql } from "../../infra/db/schema";
import { publishCountDelta } from "../../infra/cache/quota-cache";
import { checkQuota } from "../quota/checkQuota";
import { mapToBackendConnection } from "./mapToBackendConnection";

export const createConnection = (userId: number, input: CreateConnectionInput) =>
  Effect.gen(function* () {
    const { db } = yield* Database;
    const cryptoService = yield* Crypto;

    const quota = yield* Effect.promise(() => checkQuota(userId, "connections"));
    if (!quota.allowed) {
      yield* Effect.fail(
        new QuotaError({
          resource: "connections",
          current: quota.current,
          max: quota.max,
        }),
      );
    }

    // CLIENT API keys are random lookup tokens stored as-is for direct DB comparison.
    // Other connection types store OAuth/API tokens that must be protected at rest.
    const encryptedCredentials =
      input.type === ConnectionType.APP
        ? (input.credentials ?? null)
        : yield* cryptoService.encryptCredentials(userId, input.credentials ?? null);

    const encryptedWebhookSecret = yield* cryptoService.encryptCredentials(
      userId,
      input.webhookSecret ?? null,
    );

    const [inserted] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(connectionTable)
          .values({
            userId: currentUserIdSql,
            type: input.type,
            name: input.name,
            accountId: input.accountId ?? null,
            url: input.url ?? null,
            uid: input.uid ?? crypto.randomUUID(),
            credentials: encryptedCredentials,
            webhookSecret: encryptedWebhookSecret,
            includeRef: input.includeRef ?? true,
          })
          .returning(),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    yield* Effect.sync(() => publishCountDelta(userId, { connections: 1 }));

    return mapToBackendConnection(inserted);
  }).pipe(Effect.withSpan("connections.create", { attributes: { userId } }));
