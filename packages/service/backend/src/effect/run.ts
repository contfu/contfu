import { Effect, Layer, ManagedRuntime } from "effect";
import { LoggerLive } from "../infra/logger";
import { Database, DatabaseLive } from "./services/Database";
import { Crypto, CryptoLive } from "./services/Crypto";

/**
 * Minimal layer for running Effects from non-Effect code.
 * Provides Database and Crypto services (the most commonly needed).
 */
const MinimalLive = Layer.mergeAll(DatabaseLive, CryptoLive, LoggerLive);

let _minimalRuntime: ManagedRuntime.ManagedRuntime<any, any> | null = null;

function getMinimalRuntime() {
  if (!_minimalRuntime) {
    _minimalRuntime = ManagedRuntime.make(MinimalLive);
  }
  return _minimalRuntime;
}

/**
 * Run an Effect that requires Database and/or Crypto services.
 * Provides the minimal live layer automatically.
 *
 * Use this to bridge from non-Effect code (e.g., infra modules not yet migrated)
 * into Effect-based feature functions.
 */
export function runEffectWithServices<A, E>(
  effect: Effect.Effect<A, E, Database | Crypto>,
): Promise<A> {
  return getMinimalRuntime().runPromise(effect as any) as Promise<A>;
}
