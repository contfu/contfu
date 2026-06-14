# Deployment

Contfu's **Cloud Service** is managed — you use it at [contfu.com](https://contfu.com) and
never host it. What you deploy is the **Local Runtime** that holds your synchronized
content, in one of two shapes:

- **Self-hosted Server** — run the prebuilt `@contfu/server` (Docker image, or Bun/Node
  process) as an HTTP query API that any number of clients query over HTTP.
- **Embedded Local Runtime** — import `@contfu/contfu` into your own app process and query
  the Local Store in-process.

Both run the same Local Runtime under the hood: the [Connector](./concepts.md) receives
**Sync Messages** from the Cloud Service, applies them to a SQLite **Local Store**, and
downloads and processes **Files** and **Media** inside your boundary.

```
                    self-hosted Server                embedded
Cloud Service ─sync─▶ @contfu/server ─HTTP─▶ app   |  app + @contfu/contfu
                       (Local Store)                  (Local Store, in-process)
```

## Authentication key

Both shapes need the Local Runtime's authentication key to connect to the Cloud Service.
This is the app integration's key (the `CONTFU_KEY` written by
[`contfu setup`](./integrations.md#create-one)), distinct from the CLI's user credentials.

When the key is unset, the Local Runtime does **not** connect — but the Server/embedded app
can still query an existing Local Store. This is useful for read-only replicas or local
development against a pre-seeded database.

## Self-hosted Server

### Docker

```bash
docker run -d \
  -p 3001:3001 \
  -v contfu-data:/data \
  -e CONTFU_KEY=your-authentication-key \
  contfu/server:latest
```

The image runs the Local Runtime and exposes the HTTP query API on port `3001`. Mount a
volume at `/data` to persist the SQLite store across restarts.

### Bun / Node

`@contfu/server` is a thin wrapper you can run or embed directly:

```ts
import serve from "@contfu/server";

serve({ port: 3000 });
```

Or compose with your own `Bun.serve`:

```ts
import { createServeOptions } from "@contfu/server";

Bun.serve({ ...createServeOptions(), port: 3000 });
```

`serve(opts)` accepts `{ port, db, i18n }`; everything else comes from environment
variables below.

### Environment variables

| Variable                     | Default            | Description                                                                        |
| ---------------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `CONTFU_KEY`                 | —                  | Authentication key for the Cloud Service (base64url). Unset → no sync, query-only. |
| `CONTFU_DB` / `DATABASE_URL` | `/data/db` (image) | SQLite Local Store path.                                                           |
| `FILE_URL`                   | (in the database)  | File storage location — see below.                                                 |
| `CONTFU_BASIC_AUTH`          | —                  | `user:password` to require HTTP basic auth on every request.                       |
| `CONTFU_DEFAULT_LOCALE`      | —                  | Default locale for clients that send none.                                         |
| `CONTFU_FALLBACK_LOCALE`     | —                  | Fallback locale; `true` = fall back to the default, `false` = no fallback.         |

See [Localization → Server defaults](./i18n.md#server-defaults) for the locale variables.

### Basic auth

Set `CONTFU_BASIC_AUTH=user:password` to protect every request. Clients must then send a
matching `Authorization: Basic …` header.

## Embedded Local Runtime

Run the Local Runtime inside your own process and query it directly — no network hop:

```ts
import { contfu } from "@contfu/contfu";

const { query, events, fileStore, handleFileRequest } = contfu({
  key: process.env.CONTFU_KEY, // falls back to process.env.CONTFU_KEY
});

// Drive synchronization by consuming the live event stream.
for await (const event of events) {
  // item-changed, item-deleted, schema-changed, sync-started/completed, …
}

const posts = await query("blogPost", { limit: 10 });
```

`contfu(options)` returns:

- `query` — the typed [query callable](./querying.md).
- `events` — a hot `AsyncIterable` of [Sync events](#sync-event-stream); iterating it keeps
  the Local Store current and auto-reconnects with backoff.
- `fileStore` — the active file store.
- `handleFileRequest(request, filePath)` — serve stored files and on-demand media variants
  from your own routes.

The default Local Store path is `data/contfu.sqlite`; override with `DATABASE_URL`.

### Runtime options

| Option                  | Default                  | Description                                                                     |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------- |
| `key`                   | `process.env.CONTFU_KEY` | Cloud Service auth key.                                                         |
| `fileStore`             | database-backed          | Where downloaded files are stored ([below](#file--media-storage)).              |
| `mediaOptimizer`        | —                        | Media processing implementation.                                                |
| `transformMedia`        | —                        | Sync-time media conversion rules (format constraints, include/exclude filters). |
| `mediaVariants`         | —                        | Named variant presets for on-demand serving and optional pre-generation.        |
| `localFiles`            | `true`                   | Download remote files into your storage.                                        |
| `cacheOptimizedFiles`   | `true`                   | Cache optimized variants in the database.                                       |
| `mediaQueueConcurrency` | `2`                      | Concurrent media download/processing jobs.                                      |
| `i18n`                  | —                        | App-level locale defaults ([Localization](./i18n.md#embedded-local-runtime)).   |

### Platform builds

| Import                  | Runtime                                 |
| ----------------------- | --------------------------------------- |
| `@contfu/contfu`        | Bun                                     |
| `@contfu/contfu/node`   | Node.js                                 |
| `@contfu/contfu/shared` | Browser-safe subset (no local database) |

### Sync event stream

For server-side apps that only need raw live updates (not a query layer), consume the
Connector directly with `@contfu/connect`:

```ts
import { connect } from "@contfu/connect";

for await (const event of connect()) {
  if (event.type === "item-changed") console.log(event.item);
}
```

Event types include `item-changed`, `item-deleted`, `collection-renamed`,
`collection-removed`, `schema-changed`, `sync-started`, `sync-completed`, and the
`stream-*` / `stream-snapshot-*` connection lifecycle events. `connect()` auto-reconnects;
tune it with `{ reconnect, initialReconnectDelay, maxReconnectDelay, connectionEvents }`.

## File & media storage

By default, files the Local Runtime downloads are stored **in the SQLite database**. Set
`FILE_URL` (Server) or pass a `fileStore` (embedded) to store them on the filesystem or in
S3-compatible object storage instead.

| `FILE_URL` value       | Storage                       |
| ---------------------- | ----------------------------- |
| _(unset)_              | In the SQLite database.       |
| `/data/file`           | Local filesystem path.        |
| `s3://my-bucket/files` | S3-compatible object storage. |

### S3-compatible storage

When `FILE_URL` is an `s3://` URL, Bun's native S3 support is used. Configure credentials
via environment variables (each falls back to its `AWS_*` equivalent):

| Variable               | Description                                   |
| ---------------------- | --------------------------------------------- |
| `S3_ACCESS_KEY_ID`     | Access key.                                   |
| `S3_SECRET_ACCESS_KEY` | Secret key.                                   |
| `S3_ENDPOINT`          | Endpoint URL (required for non-AWS services). |
| `S3_REGION`            | Region (default `us-east-1`).                 |
| `S3_BUCKET`            | Default bucket.                               |
| `S3_SESSION_TOKEN`     | Temporary session token (optional).           |

Works with AWS S3, Cloudflare R2, DigitalOcean Spaces, MinIO, and any S3-compatible
service. Example with Cloudflare R2:

```bash
docker run -d \
  -p 3001:3001 \
  -v contfu-data:/data \
  -e CONTFU_KEY=your-authentication-key \
  -e FILE_URL=s3://my-bucket/files \
  -e S3_ACCESS_KEY_ID=your-access-key \
  -e S3_SECRET_ACCESS_KEY=your-secret-key \
  -e S3_ENDPOINT=https://account-id.r2.cloudflarestorage.com \
  contfu/server:latest
```

### Custom stores in embedded mode

In embedded mode, pass concrete implementations:

```ts
import { contfu } from "@contfu/contfu";
import { BunFileStore } from "@contfu/bun-file-store";
import { M4kOptimizer } from "@contfu/media-optimizer";

const { query, events } = contfu({
  fileStore: new BunFileStore("/var/contfu/files"),
  mediaOptimizer: new M4kOptimizer(),
});
```

Files are downloaded, stored, and processed inside your application boundary while Sync
Messages are applied — the Cloud Service never owns file storage or media processing.

## Choosing a shape

|             | Embedded                                    | Server + Client                                  |
| ----------- | ------------------------------------------- | ------------------------------------------------ |
| Network hop | None (in-process)                           | HTTP                                             |
| Consumers   | The host process                            | Any number, incl. browser/edge                   |
| Package     | `@contfu/contfu`                            | `@contfu/server` + `@contfu/client`              |
| Best for    | A single server app reading content locally | Multiple apps/services, or a separate query tier |

Because the [query API is identical](./querying.md#two-clients-one-api), you can start
embedded and move to Server + Client (or vice versa) without rewriting query code.
