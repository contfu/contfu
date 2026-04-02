# @contfu/client

HTTP client for querying content from a remote Contfu server.

## When to use

Contfu supports two modes for accessing content:

1. **Remote server** — content is stored and queried on a server. Use `@contfu/client` to query from the browser or any HTTP client.
2. **Local database** — content is stored and queried locally. Use `@contfu/contfu` directly.

Choose `@contfu/client` when your application talks to a Contfu server over HTTP rather than accessing a local database.

## Usage

```ts
import { createHttpTypedClient } from "@contfu/client";

const client = createHttpTypedClient("https://your-server.example.com", "your-token");

const items = await client.items.query({ collection: "posts" });
```

## Exports

- `createHttpTypedClient(baseUrl, token)` — create a typed HTTP client
- `serializeQueryParams(opts)` — serialize filter/sort/include options to URL query params
- `QueryResultArray` — typed wrapper around paginated item results
- Types: `IncludeOption`, `QueryMeta`, `QueryOptions`, `SortOption`, `WithClause`
