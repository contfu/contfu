import { Effect } from "effect";
import { Database } from "@contfu/svc-backend/effect/services/Database";
import { getRuntime } from "./effect-runtime";

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
  return (getRuntime() as any).runPromise(wrapped) as Promise<A>;
}

/**
 * Run an Effect without user context (e.g., for operations that don't need RLS).
 */
export function run<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return (getRuntime() as any).runPromise(effect) as Promise<A>;
}
