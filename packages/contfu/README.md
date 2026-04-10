# @contfu/contfu

Core library for building Contfu-powered applications with a local database.

Use this package when you want to store and query content locally. If you prefer to query a remote Contfu server over HTTP, use `@contfu/client` instead.

## Usage

By default, `@contfu/contfu` stores its SQLite database at `data/contfu.sqlite`. Override this with the `DATABASE_URL` environment variable when needed.

```ts
import { connect } from "@contfu/contfu";

// Sync content into the local database
for await (const event of connect()) {
  console.log(event.type, event);
}
```

## Media processing

You can plug in custom media storage and optimization by passing `mediaStore` and `mediaOptimizer` options to `connect()`:

```ts
import { connect } from "@contfu/contfu";
import { FileStore } from "@contfu/bun-file-store";
import { M4kOptimizer } from "@contfu/media-optimizer";

for await (const event of connect({
  mediaStore: new FileStore("/var/contfu/media"),
  mediaOptimizer: new M4kOptimizer(),
})) {
  // assets are stored and optimized automatically during sync
}
```

## Platform builds

- `@contfu/contfu` — Bun runtime
- `@contfu/contfu/node` — Node.js runtime
- `@contfu/contfu/shared` — browser-safe subset (no local database)
