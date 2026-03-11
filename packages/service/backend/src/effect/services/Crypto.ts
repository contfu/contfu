import { Effect, Layer, ServiceMap } from "effect";
import { CryptoError } from "../errors";

export class Crypto extends ServiceMap.Service<
  Crypto,
  {
    readonly encryptCredentials: (
      userId: number,
      credentials: Buffer | null | undefined,
    ) => Effect.Effect<Buffer | null, CryptoError>;
    readonly decryptCredentials: (
      userId: number,
      encryptedCredentials: Buffer | null | undefined,
    ) => Effect.Effect<Buffer | null, CryptoError>;
  }
>()("@contfu/Crypto") {}

/**
 * Production layer — wraps the existing crypto/credentials module.
 */
export const CryptoLive = Layer.effect(Crypto)(
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/crypto/credentials"),
      catch: (e) => new CryptoError({ cause: e, operation: "encrypt" }),
    });

    return {
      encryptCredentials: (userId: number, credentials: Buffer | null | undefined) =>
        Effect.tryPromise({
          try: () => mod.encryptCredentials(userId, credentials),
          catch: (e) => new CryptoError({ cause: e, operation: "encrypt" }),
        }).pipe(Effect.withSpan("crypto.encrypt")),

      decryptCredentials: (userId: number, encryptedCredentials: Buffer | null | undefined) =>
        Effect.tryPromise({
          try: () => mod.decryptCredentials(userId, encryptedCredentials),
          catch: (e) => new CryptoError({ cause: e, operation: "decrypt" }),
        }).pipe(Effect.withSpan("crypto.decrypt")),
    };
  }),
);
