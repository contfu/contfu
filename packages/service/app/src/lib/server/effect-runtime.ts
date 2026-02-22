import { ManagedRuntime } from "effect";
import { AppLive } from "@contfu/svc-backend/effect/layers/AppLive";

/**
 * Lazily-created ManagedRuntime for the SvelteKit app.
 * Created on first access to avoid module-evaluation-time side effects
 * that can cause Bun segfaults in the built bundle.
 */
let _runtime: ManagedRuntime.ManagedRuntime<any, any> | null = null;

export function getRuntime() {
  if (!_runtime) {
    _runtime = ManagedRuntime.make(AppLive);
  }
  return _runtime;
}
