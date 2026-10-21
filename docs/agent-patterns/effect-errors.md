# Errors

- Expected failures are `Data.TaggedError` classes: `packages/service/backend/src/effect/errors/index.ts`
  (database, not-found, quota, validation, ...) and `packages/service/integrations/src/errors.ts`
  (integration failures, built with `mapHttpIntegrationError` / `mapUnknownIntegrationError`).
  Give them a `message` getter so logs stay readable.
- Promise code enters Effect through `Effect.tryPromise({ try, catch })`, and the `catch` maps to a
  tagged error (`new DatabaseError({ cause: e })`). `Effect.promise` turns a rejection into a defect:
  use it only when failure is genuinely unexpected.
- Handle by tag: `Effect.catchTag("QuotaError", ...)` (see `routes/api/v1/collections/+server.ts`).
  `Effect.catch` replaces v3's `catchAll`.
- Fail with `return yield* new MyError({...})` inside generators so TypeScript sees the exit.
- Defects (`Effect.die`, `Effect.orDie`) are for bugs and unrecoverable infrastructure failures.
