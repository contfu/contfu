import { Context, Effect, Layer } from "effect";
import { SyncWorkerManager as SyncWorkerManagerClass } from "../../infra/sync-worker/worker-manager";

export class SyncWorkerManagerService extends Context.Tag("@contfu/SyncWorkerManager")<
  SyncWorkerManagerService,
  SyncWorkerManagerClass
>() {}

/**
 * Production layer — creates a SyncWorkerManager with acquire/release lifecycle.
 * The worker is started on layer creation and stopped on disposal.
 */
export const SyncWorkerManagerLive = Layer.scoped(
  SyncWorkerManagerService,
  Effect.acquireRelease(
    Effect.gen(function* () {
      const manager = new SyncWorkerManagerClass();
      yield* Effect.tryPromise({
        try: () => manager.start(),
        catch: (e) => new Error(`Failed to start sync worker: ${e}`),
      });
      return manager;
    }),
    (manager) =>
      Effect.tryPromise({
        try: () => manager.stop(),
        catch: () => void 0,
      }).pipe(Effect.orDie),
  ),
);
