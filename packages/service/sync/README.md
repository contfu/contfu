# @contfu/svc-sync

Sync worker for the Contfu service.

Runs as a Bun Worker that claims sync jobs from the database, pulls content from source adapters (`@contfu/svc-sources`), and persists items via `@contfu/svc-backend`.

## How it works

1. The worker polls for pending sync jobs using `claimJobs`
2. For each job, it instantiates the appropriate source adapter
3. Items are fetched incrementally (since last sync index)
4. Each item is upserted into the database and broadcast over NATS
5. Jobs are marked complete or failed with retry/backoff logic

## Entry point

`src/worker.ts` — loaded as a Bun Worker by `@contfu/svc-backend`.
