# Running effects

- Features return effects; they do not run them. Routes run them through the app runtime
  (`packages/service/app/src/lib/server/`), and non-Effect infra code goes through
  `effect/run.ts` (`runEffectWithServices`, `runEffectWithUserContext`).
- When a Promise-based API (a database transaction, a drizzle callback) must call back into Effect,
  capture the context with `Effect.context<R>()` and use `Effect.runPromiseWith(context)`; see
  `effect/services/Database.ts` (`withUserContext`) for the canonical case.
- Specs provide fakes with `Layer.succeed(Service)(impl)` and run with `Effect.runPromise`; see
  `features/target-delivery/target-delivery.spec.ts`.
- Time: inside an effect use `Effect.sleep`, `Schedule` and `Effect.repeat` (interruptible), not
  `setTimeout` promises.
