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

## Entry points

| Import                  | Runtime                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `@contfu/contfu`        | Default Local Runtime entry. Uses Bun's DB client under Bun and a Node-compatible fallback elsewhere.                          |
| `@contfu/contfu/node`   | Node.js Local Runtime entry that loads the Node SQLite client directly.                                                        |
| `@contfu/contfu/shared` | Shared Local Runtime exports without the `db` singleton export; still intended for server-side local-store code, not browsers. |

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

## Public exports

The package barrel exports the Local Runtime surface used by embedded applications:

- Runtime orchestration: `connect`, `contfu`, `createRuntimeEventMonitor`, and runtime status/event types.
- Local Store access: `db`, generated table definitions, row/update types, item CRUD helpers, collection helpers, sync-index helpers, and file helpers.
- Querying: `findItems`, `queryItems`, `getItemById`, `QueryResultArray`, filter builders such as `eq`, `and`, `linksTo`, and typed query helper types.
- Media and files: `FileStore`, `DBStore`, `fileStore`, `loadFile`, `convertMedia`, media optimizer/config types, and file progress/content types.
- Hooks and utilities: event hook composition helpers, `generateTypes`, local-store count/list helpers, `deleteNulls`, and `detectRuntime`.

`@contfu/contfu/shared` omits the root-only `db` singleton export but otherwise exposes the shared Local Runtime API used by the runtime-specific entry points.

## Import boundaries (VSA)

- `features/<slice>/` contains public feature modules with at most one exported callable each.
- `shared/<topic>/` contains reusable implementation and `domain/` contains pure business rules.
- `infra/` contains storage and runtime adapters.

Feature slices may use the architecture layers, but may not import sibling feature slices.
The top-level `connect` module is the explicit composition root. Oxlint enforces both this
path-aware boundary and the one-callable-export rule as errors without slice-specific exceptions.
