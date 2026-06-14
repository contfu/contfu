# @contfu/client

HTTP client for querying content from a Contfu Server.

## When to use

Use `@contfu/client` when your application talks to a user-hosted Contfu Server over HTTP. A Client only queries a Server; it does not synchronize with the Cloud Service or with the Server.

For local access, use `@contfu/contfu` directly beside the Local Store.

## Usage

```ts
import { contfuClient } from "@contfu/client";

const client = contfuClient("https://your-server.example.com", "your-token", {
  i18n: { defaultLocale: "en", fallback: true },
});

const items = await client.items.query({ collection: "posts" });
```

## Exports

- `contfuClient(baseUrl, token, { i18n })` — create a typed HTTP client
- `serializeQueryParams(opts)` — serialize filter/sort/include options to URL query params
- `QueryResultArray` — typed wrapper around paginated item results
- Types: `IncludeOption`, `QueryMeta`, `QueryOptions`, `SortOption`, `WithClause`
