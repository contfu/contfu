import { Effect, Layer, ManagedRuntime } from "effect";
import { Database, DatabaseLive } from "../src/effect/services/Database";
import { CryptoLive } from "../src/effect/services/Crypto";

/**
 * Minimal test layer providing Database and Crypto services.
 * Uses PGlite when NODE_ENV=test (set by test environment).
 */
const TestLive = Layer.mergeAll(DatabaseLive, CryptoLive);

const testRuntime = ManagedRuntime.make(TestLive);

/**
 * Run an Effect in the test environment within the given user's DB context.
 * Sets up RLS via withUserContext so queries are scoped to the user.
 */
export function runTest<A, E, R>(userId: number, effect: Effect.Effect<A, E, R>): Promise<A> {
  const wrapped = Effect.gen(function* () {
    const db = yield* Database;
    return yield* db.withUserContext(userId, effect);
  });
  return (testRuntime as any).runPromise(wrapped) as Promise<A>;
}
