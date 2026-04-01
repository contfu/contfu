# @contfu/svc-app

Contfu cloud service application.

The main HTTP entrypoint for the Contfu SaaS backend. Composes `@contfu/svc-backend` routes, starts the sync worker, and serves the admin UI.

## Development

```sh
bun dev        # start dev server with hot reload
bun build      # production build
bun start      # run production server
```

## Structure

- `src/routes/` — SvelteKit file-based routes (admin dashboard, API endpoints)
- `src/lib/` — shared components and utilities
- `backend/` — `@contfu/svc-backend` package
- `core/` — `@contfu/svc-core` package
- `sources/` — `@contfu/svc-sources` package
- `sync/` — `@contfu/svc-sync` package

## Environment

Key environment variables:

| Variable             | Description                                      |
| -------------------- | ------------------------------------------------ |
| `DATABASE_URL`       | PostgreSQL connection string                     |
| `NATS_SERVER`        | NATS JetStream server URL                        |
| `BETTER_AUTH_SECRET` | Secret for session signing                       |
| `CONTFU_SECRET`      | Key for encrypting stored credentials            |
| `LOG_LEVEL`          | Log verbosity (`debug`, `info`, `warn`, `error`) |

See `.env` for the full list.
