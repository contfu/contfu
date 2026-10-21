# Services and layers

- A service is a class extending `Context.Service<Self, Shape>()("@contfu/Name")`. Examples:
  `packages/service/backend/src/effect/services/Mail.ts`, `Crypto.ts`, `Database.ts`.
- Layers are built with `Layer.effect(Service)(effect)`; `Layer.effectContext` when one acquisition
  provides several services (`Database.ts` provides `Database`, `DrizzleDatabase` and `RawDbClient`).
- Resources use `Effect.acquireRelease` inside the layer so that the runtime owns their lifetime.
- Live and fake wiring is chosen once, in `effect/layers/AppInfra.ts` (`AppInfraFromMode`). Add a
  `*Fake` layer next to the live one instead of branching inside a feature.
- Configuration is `AppConfig` (`effect/services/Config.ts`), built from `Config.String`,
  `Config.Number`, `Config.Redacted`. In Effect 4 the constructors are capitalised.
- Telemetry (`effect/telemetry/index.ts`) uses `Otlp` from `effect/observability` and the fetch
  client from `effect/http`; there is no `unstable` segment in the import path any more.
- Reach a service through `yield* Service` in a generator; do not pass services as arguments.
