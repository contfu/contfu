# @contfu/contfu

Contfu runtime and local store library for Contfu-powered applications.

Use this package when you want to receive Sync Messages through the Connector, apply them into a local SQLite database, process Media Files, and query content locally. If your application should query a user-hosted Server over HTTP, use `@contfu/client` instead. To host that HTTP query API over this runtime and Local Store, use `@contfu/server`.

## Usage

By default, `@contfu/contfu` stores its SQLite database at `data/contfu.sqlite`. Override this with the `DATABASE_URL` environment variable when needed.

```ts
import { connect } from "@contfu/contfu";

// Run the Contfu runtime: receive Sync Messages and write the Local Store.
for await (const event of connect()) {
  console.log(event.type, event);
}
```

## Entry points

| Import                  | Runtime                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `@contfu/contfu`        | Default Contfu runtime entry. Uses Bun's DB client under Bun and a Node-compatible fallback elsewhere.                          |
| `@contfu/contfu/node`   | Node.js Contfu runtime entry that loads the Node SQLite client directly.                                                        |
| `@contfu/contfu/shared` | Shared Contfu runtime exports without the `db` singleton export; still intended for server-side local-store code, not browsers. |

## File and media processing

`@contfu/contfu` is the embedded Contfu runtime and local store. During `connect()`, it receives item data and File references, downloads referenced files from their source URLs, stores them locally, and processes media inside the application boundary. Contfu does not own file storage or media processing for this package.

You can plug in custom local or application-operated file storage and media optimization by passing `fileStore` and `mediaOptimizer` options to `connect()`:

```ts
import { connect } from "@contfu/contfu";
import { BunFileStore } from "@contfu/bun-file-store";
import { M4kOptimizer } from "@contfu/media-optimizer";

for await (const event of connect({
  fileStore: new BunFileStore("/var/contfu/files"),
  mediaOptimizer: new M4kOptimizer(),
})) {
  // Files are downloaded, stored, and processed by the Contfu runtime while Sync Messages are applied.
}
```

## Public exports

The package barrel exports the Contfu runtime and local store library surface used by embedded applications:

- Runtime orchestration: `connect`, `contfu`, `createRuntimeEventMonitor`, and runtime status/event types.
- Local Store access: `db`, generated table definitions, row/update types, item CRUD helpers, collection helpers, sync-index helpers, and file helpers.
- Querying: `findItems`, `queryItems`, `getItemById`, `QueryResultArray`, filter builders such as `eq`, `and`, `linksTo`, and typed query helper types.
- Media and files: `FileStore`, `DBStore`, `fileStore`, `loadFile`, `convertMedia`, media optimizer/config types, and file progress/content types.
- Hooks and utilities: event hook composition helpers, `generateTypes`, local-store count/list helpers, `deleteNulls`, and `detectRuntime`.

`@contfu/contfu/shared` omits the root-only `db` singleton export but otherwise exposes the shared library API used by the runtime-specific entry points.

## Import boundaries (VSA)

- `features/<slice>/` contains public feature modules with at most one exported callable each.
- `shared/<topic>/` contains reusable implementation and `domain/` contains pure business rules.
- `infra/` contains storage and runtime adapters.

Feature slices may use the architecture layers, but may not import sibling feature slices.
The top-level `connect` module is the explicit composition root. Oxlint enforces both this
path-aware boundary and the one-callable-export rule as errors without slice-specific exceptions.

## Collection-scoped identities (breaking change)

Query results expose `$id` as an `ItemIdentity` tuple: `[collection, numericId]`.
The same managed numeric ID may appear in multiple collections with different
properties. Keep both dimensions when caching, linking, looking up, or deleting items.

```ts
import { getItemById, findItems } from "@contfu/contfu";

const article = getItemById(["articles", 30]);
const references = findItems({ filter: 'linksTo() = ["articles",30]' });
```

REF values and internal rich-content anchor destinations use the same tuple; REFS
values are arrays of tuples. Schema messages include `refTargets`, identifying the
single delivered collection for each relation. Missing or ambiguous destinations
are rejected rather than guessed. Use `eq(item.$id, ["articles", 30])` in typed filters.

Upgrade the backend, core, Connector, Contfu, Server, and generated consumer types
together. On the first writable open, legacy synchronized SQLite tables (including
file metadata/media caches) and the sync checkpoint are automatically reset and
rebuilt through replay. Unrelated tables/configuration are preserved. Allow time
for replay and media processing; read-only replicas must receive an upgraded store.
