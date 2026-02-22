import { Effect, Layer, ManagedRuntime } from "effect";
import { DatabaseLive } from "../src/effect/services/Database";
import { CryptoLive } from "../src/effect/services/Crypto";

/**
 * Minimal test layer providing Database and Crypto services.
 * Uses PGlite when TEST_MODE=true (set by test environment).
 */
const TestLive = Layer.mergeAll(DatabaseLive, CryptoLive);

const testRuntime = ManagedRuntime.make(TestLive);

/**
 * Run an Effect in the test environment.
 * Provides Database and Crypto services automatically.
 */
export function runTest<A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> {
  return (testRuntime as any).runPromise(effect) as Promise<A>;
}
