import { Cause, Effect } from "effect";
import { Database } from "@contfu/svc-backend/effect/services/Database";
import { createLogger } from "@contfu/svc-backend/infra/logger/index";
import { getRuntime } from "./effect-runtime";

const log = createLogger("run");

function handleEffectError(err: unknown): never {
  // Effect's runPromise rejects with a FiberFailure wrapping the cause.
  // Extract the actual error for logging.
  if (err && typeof err === "object" && Symbol.for("effect/Runtime/FiberFailure") in err) {
    const cause = (err as any)[Symbol.for("effect/Runtime/FiberFailure/Cause")];
    if (cause) {
      const failures = Cause.failures(cause);
      for (const f of failures) {
        log.error({ err: f }, "Effect failure: %s", f?.message ?? f);
      }
    }
  }
  throw err;
}

/**
 * Run an Effect within the user's database context.
 * This replaces the old `withUserDbContext` wrapper from hooks.server.ts.
 *
 * The runtime provides all services (Database, Crypto, etc.) so effects
 * requiring any combination of these services are accepted.
 */
export function runWithUser<A, E, R>(userId: number, effect: Effect.Effect<A, E, R>): Promise<A> {
  const wrapped = Effect.gen(function* () {
    const db = yield* Database;
    return yield* db.withUserContext(userId, effect);
  });
  return ((getRuntime() as any).runPromise(wrapped) as Promise<A>).catch(handleEffectError);
}

/**
 * Run an Effect without user context (e.g., for operations that don't need RLS).
 */
export function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return ((getRuntime() as any).runPromise(effect) as Promise<A>).catch(handleEffectError);
}
