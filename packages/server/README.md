# @contfu/server

User-hosted Bun HTTP Server for Contfu.

`@contfu/server` wraps the `@contfu/contfu` Local Runtime package: the Local Runtime uses the Connector to receive Sync Messages from the Cloud Service, applies them to the Local Store, processes Media Files, and the Server exposes HTTP query endpoints over that Local Store.

The synchronization implementation lives in `@contfu/contfu`; `@contfu/server` only hosts the HTTP API and observes Local Runtime events for status and live UI invalidation.

## Usage

`@contfu/server` is a Bun HTTP server wrapper.

```ts
import serve from "@contfu/server";

serve({ port: 3000 });
```

Or compose with your own `Bun.serve` call:

```ts
import { createServeOptions } from "@contfu/server";

Bun.serve({
  ...createServeOptions(),
  port: 3000,
});
```

## Prerequisites

Configure the Local Runtime through environment variables:

- `CONTFU_KEY` — authentication key for the Cloud Service. When unset, the Server can still query an existing Local Store but no synchronization runs.
- `CONTFU_DB` or `DATABASE_URL` — SQLite Local Store path.
- `FILE_URL` — optional file storage location for Media Files.
- `CONTFU_DEFAULT_LOCALE` — optional default locale for requests that omit `locale`.
- `CONTFU_FALLBACK_LOCALE` — optional fallback locale; `true` falls back to the default locale and `false` disables fallback.

## HTTP API

All routes are `GET` routes and are protected when Basic auth is configured.

| Route                          | Purpose                                                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `/api/items`                   | Query items with `filter`, `search`, `sort`, `limit`, `offset`, `include`, `fields`, `flat`, `with`, `locale`, and `fallback`. |
| `/api/collections/:name/items` | Query one collection with the same query parameters as `/api/items`.                                                           |
| `/api/items/:id`               | Fetch one item by Contfu item id; supports `include` and `with`.                                                               |
| `/api/items/:id/files`         | List files linked to one item.                                                                                                 |
| `/api/collections`             | List collections.                                                                                                              |
| `/api/collections/:name`       | Return collection metadata, admin query rows, schema, and generated types.                                                     |
| `/api/query-items`             | UI/admin item listing endpoint with collection, change-window, prop-filter, sort, and page parameters.                         |
| `/api/types`                   | Return generated application TypeScript types.                                                                                 |
| `/api/status`                  | Return item, collection, file, and sync-status counts.                                                                         |
| `/api/live`                    | Server-sent events for runtime status and data-change notifications.                                                           |
| `/files/:path`                 | Serve stored files and on-demand media variants.                                                                               |

## Basic auth

Optional HTTP basic auth can protect every request handled by `@contfu/server`.

Set `CONTFU_BASIC_AUTH` to `user:password` to enable it.

When set, requests must include the matching `Authorization: Basic ...` header or the Server responds with `401 Unauthorized` and `WWW-Authenticate: Basic realm="Contfu"`.

If `CONTFU_BASIC_AUTH` is unset or malformed, basic auth is disabled and behavior stays unchanged.
