# @contfu/ui

SvelteKit dashboard for inspecting a Contfu Local Store through a user-hosted Contfu Server.

The UI queries `@contfu/server` over HTTP. It does not connect to the Cloud Service or synchronize content; the Local Runtime is responsible for receiving Sync Messages through the Connector and writing the Local Store.

## Development

```sh
bun dev        # start Vite dev server
bun build      # production build
bun preview    # preview production build
```

## Structure

- `src/routes/` — SvelteKit file-based routes
- `src/lib/components/` — shared UI components
- `build/` — compiled dashboard output

## Basic auth

Set `CONTFU_BASIC_AUTH` to `user:password` to enable optional HTTP basic auth for `@contfu/ui`.

When set, unauthenticated browser requests receive `401 Unauthorized` with `WWW-Authenticate: Basic realm="Contfu"`. SvelteKit app asset requests under `/_app/` remain unchallenged.

The same `CONTFU_BASIC_AUTH` value is also used for server-side requests to a protected `@contfu/server`: the UI strips any incoming browser `Authorization` header and injects the configured basic-auth header into proxied `/api/*` and `/files/*` requests and into server-side data-loading requests.

If `CONTFU_BASIC_AUTH` is unset or malformed, the UI does not challenge browser requests and does not send upstream basic auth.

This package is not published to npm.
