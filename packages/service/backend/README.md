# @contfu/svc-backend

Backend logic for the Contfu cloud service.

Contains API route handlers, domain features, infrastructure adapters, and the push worker. Used by `@contfu/svc-app` (the HTTP entrypoint) and `@contfu/svc-sync` (the sync worker).

## Structure

- `src/features/` — vertical feature slices (admin, collections, connections, consumers, flows, incidents, quota, schema-sync, sync, sync-jobs)
- `src/domain/` — domain model and business rules
- `src/infra/` — database access (Drizzle/Postgres), NATS messaging, logger, sync-worker messages
- `src/effect/` — Effect-based services and error types
- `src/push-worker/` — WebSocket push worker for live updates

## Dependencies

Requires a PostgreSQL database and a NATS JetStream server. Configuration via environment variables.
