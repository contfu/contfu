# @contfu/client

HTTP client for querying content from a Contfu Server.

## When to use

Use `@contfu/client` when your application talks to a user-hosted Contfu Server over HTTP. A Client only queries a Server; it does not synchronize with Contfu or with the Server.

For local access, use `@contfu/contfu` directly beside the Local Store.

## Usage

```ts
import { contfuClient } from "@contfu/client";

const query = contfuClient("https://your-server.example.com", undefined, {
  i18n: { defaultLocale: "en", fallback: true },
  // Use this when the Server is protected with CONTFU_BASIC_AUTH=user:password.
  basicAuth: "user:password",
});

const posts = await query("posts", { limit: 10 });
```

Pass a second argument only when your deployment expects a Bearer token, for example behind a custom proxy:

```ts
const query = contfuClient("https://your-server.example.com", "bearer-token");
```

## Exports

- `contfuClient(baseUrl, token?, { i18n, basicAuth })` — create a typed HTTP query callable
- `serializeQueryParams(opts)` — serialize query options such as filter, search, sort, include, fields, locale, fallback, and flat mode to URL query params
- `QueryResultArray` — typed wrapper around paginated item results
- Query helpers from `@contfu/core`: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `and`, `or`, `all`, `oneOf`, `contains`, `like`, `notLike`, `linksTo`, `linkedFrom`, `createItemRef`, and `isFieldRef`
- Rich-content render helpers from `@contfu/core`: `renderBlock`, `renderBlocks`, `renderInline`, `renderInlines`, and their Markdown variants
- Types: `HttpClientOptions`, `QueryOptions`, `QueryMeta`, `SortOption`, `IncludeOption`, `WithClause`, query field/ref types, and rich-content render types
