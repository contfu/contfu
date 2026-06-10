# @contfu/contfu

Local Runtime and Local Store library for Contfu-powered applications.

Use this package when you want to receive Sync Messages through the Connector, apply them into a local SQLite database, process Media Files, and query content locally. If your application should query a user-hosted Server over HTTP, use `@contfu/client` instead.

## Usage

By default, `@contfu/contfu` stores its SQLite database at `data/contfu.sqlite`. Override this with the `DATABASE_URL` environment variable when needed.

```ts
import { connect } from "@contfu/contfu";

// Run the Local Runtime: receive Sync Messages and write the Local Store.
for await (const event of connect()) {
  console.log(event.type, event);
}
```

## File and media processing

`@contfu/contfu` runs inside the Local Runtime. During `connect()`, it receives item data and File references, downloads referenced files from their source URLs, stores them locally, and processes media inside the application boundary. The Cloud Service does not own file storage or media processing for this package.

You can plug in custom local or application-operated file storage and media optimization by passing `fileStore` and `mediaOptimizer` options to `connect()`:

```ts
import { connect } from "@contfu/contfu";
import { BunFileStore } from "@contfu/bun-file-store";
import { M4kOptimizer } from "@contfu/media-optimizer";

for await (const event of connect({
  fileStore: new BunFileStore("/var/contfu/files"),
  mediaOptimizer: new M4kOptimizer(),
})) {
  // Files are downloaded, stored, and processed by the Local Runtime while Sync Messages are applied.
}
```

## Platform builds

- `@contfu/contfu` — Bun runtime
- `@contfu/contfu/node` — Node.js runtime
- `@contfu/contfu/shared` — browser-safe subset (no local database)
