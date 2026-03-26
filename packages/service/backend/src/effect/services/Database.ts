import { Effect, Exit, Layer, ServiceMap } from "effect";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type { EmptyRelations } from "drizzle-orm/relations";
import type * as schema from "../../infra/db/schema";
import { DatabaseError } from "../errors";

export type DrizzleDb = PgAsyncDatabase<PgQueryResultHKT, typeof schema, EmptyRelations>;

export class Database extends ServiceMap.Service<
  Database,
  {
    readonly db: DrizzleDb;
    readonly withUserContext: <A, E, R>(
      userId: number,
      effect: Effect.Effect<A, E, R>,
    ) => Effect.Effect<A, E | DatabaseError, R>;
  }
>()("@contfu/Database") {}

/**
 * Production layer — wraps the existing Drizzle db proxy and withUserDbContext.
 * Uses dynamic import to avoid triggering top-level await side effects at import time.
 */
export const DatabaseLive = Layer.effect(Database)(
  Effect.gen(function* () {
    const mod = yield* Effect.tryPromise({
      try: () => import("../../infra/db/db"),
      catch: (e) => new DatabaseError({ cause: e }),
    });

    return {
      db: mod.db,
      withUserContext: <A, E, R>(userId: number, effect: Effect.Effect<A, E, R>) =>
        Effect.flatMap(Effect.services<R>(), (services) =>
          Effect.callback<A, E | DatabaseError>((resume) => {
            mod
              .withUserDbContext(userId, () => Effect.runPromiseExitWith(services)(effect))
              .then((exit) =>
                resume(
                  Exit.match(exit, {
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
