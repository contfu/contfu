# Offline replicas

Contfu allows one active sync consumer per application integration. Another connection receives HTTP 409 (`E_CONSUMER_CONNECTED`); the Connector reports the conflict and stops retrying. Restart it after correcting the deployment. A closed connection releases ownership; a crashed service's reservation expires within 30 seconds.

Replicate the consumer database yourself, or let multiple application instances query one `@contfu/server`. Do not run independent syncing runtimes with the same application key.

```ts
const runtime = contfu({ offline: true });
const articles = await runtime.query("articles");
```

`offline` defaults to `false`. When true, it suppresses background sync even if an explicit key or `CONTFU_KEY` is set. Queries and file serving remain available. The event iterator remains idle. Offline file serving does not write optimized variants into the database.

For a read-only SQLite replica, set these environment variables **before importing** the runtime:

```sh
DATABASE_URL=/litefs/contfu.sqlite
CONTFU_DATABASE_READONLY=true
```

The database must already exist and have the schema migrated by the writer. Read-only startup skips migrations and journal-mode changes. `offline` controls networking; `CONTFU_DATABASE_READONLY` controls the default database's write access. They are separate so an offline runtime can also query an ordinary writable local database.

Alternatively, open a database explicitly with `createDatabaseClient(path, { readonly: true })` and pass it as `database` to `contfu`.

The writer can select rollback journaling using `CONTFU_DATABASE_JOURNAL_MODE=delete`; the default is WAL. Use the journal mode required by your replication setup. Keep exactly one writer, and arrange for the replicas to wait for the initialized database before starting. Database replication and writer failover are the deploying application's responsibility.
