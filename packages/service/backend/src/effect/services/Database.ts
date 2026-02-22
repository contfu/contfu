import { Context, Effect, Exit, Layer, Runtime } from "effect";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type * as schema from "../../infra/db/schema";
import { DatabaseError } from "../errors";

export type DrizzleDb = PgAsyncDatabase<any, typeof schema, any>;

export class Database extends Context.Tag("@contfu/Database")<
  Database,
  {
    readonly db: DrizzleDb;
    readonly withUserContext: <A, E, R>(
      userId: number,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | DatabaseError, R>;
  }
>() {}

/**
 * Production layer — wraps the existing Drizzle db proxy and withUserDbContext.
 * Uses dynamic import to avoid triggering top-level await side effects at import time.
 */
export const DatabaseLive = Layer.effect(
  Database,
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/db/db"),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return {
      db: mod.db,
      withUserContext: <A, E, R>(userId: number, effect: Effect.Effect<A, E, R>) =>
        Effect.flatMap(Effect.runtime<R>(), (rt) =>
          Effect.async<A, E | DatabaseError>((resume) => {
            mod
              .withUserDbContext(userId, () => Runtime.runPromiseExit(rt)(effect))
              .then((exit) =>
                resume(
                  Exit.matchEffect(exit, {
                    onFailure: (cause) => Effect.failCause(cause),
                    onSuccess: (a) => Effect.succeed(a),
                  }),
                ),
              )
              .catch((e) => resume(Effect.fail(new DatabaseError({ cause: e }))));
          }),
        ),
    };
  }),
);
