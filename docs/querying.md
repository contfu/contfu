# Querying Content

Applications read content through a single typed **query callable**. The same call shape
works whether you query an embedded Local Store in-process or a remote Server over HTTP, so
you can switch between the two without rewriting query code.

## Two clients, one API

| Package          | Use when                                                                               | Create with                           |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| `@contfu/contfu` | Your app process runs the Contfu runtime and reads the Local Store directly.           | `contfu()` → `{ query }`              |
| `@contfu/client` | Your app queries a [self-hosted Server](./deployment.md#self-hosted-server) over HTTP. | `contfuClient(url, token?, options?)` |

### Embedded runtime (`@contfu/contfu`)

```ts
import { contfu } from "@contfu/contfu";

const { query, events } = contfu();

const posts = await query("blogPost", { limit: 10 });
```

`contfu()` returns the query callable, the live `events` stream, the `fileStore`, and a
`handleFileRequest` helper. See [Deployment](./deployment.md#embedded-runtime) for
the runtime options.

### HTTP (Client)

```ts
import { contfuClient } from "@contfu/client";

const query = contfuClient("https://content.example.com", undefined, {
  // If the Server uses CONTFU_BASIC_AUTH=user:password:
  basicAuth: "user:password",
});

const posts = await query("blogPost", { limit: 10 });
```

The HTTP client only queries — it never synchronizes. It throws on non-2xx responses. Pass a
second argument only when your deployment expects a Bearer token, for example behind a
custom proxy.

## Calling conventions

The callable accepts a collection name and an options object. Several shorthands exist:

```ts
await query("blogPost"); // all items in a collection
await query("blogPost", { limit: 10 }); // collection + options
await query("blogPost", (p) => query.eq(p.slug, "x")); // collection + filter shorthand
await query({ collection: "blogPost", limit: 10 }); // single options object
```

Every result is a `QueryResultArray` — an array of items that also carries pagination
`meta`.

## Query options

| Option                | Description                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `collection`          | Collection slug (or pass it as the first positional argument).                                 |
| `filter`              | A filter expression — a string, or a function `(p) => …` built from the filter helpers below.  |
| `sort`                | Comma-separated field list; prefix a field with `-` for descending (e.g. `-$changedAt,title`). |
| `limit`               | Maximum items to return.                                                                       |
| `offset`              | Skip N items (offset pagination).                                                              |
| `fields`              | Restrict the returned props to a named subset.                                                 |
| `search`              | Convenience title search; matches `props.title` with a SQL `LIKE` pattern.                     |
| `include`             | Include related data: `files`, `links`, or `content`.                                          |
| `with`                | Nested relationship queries (see [Relations](#relations)).                                     |
| `flat`                | Flatten nested object props into dot-separated result keys.                                    |
| `locale` / `fallback` | Locale selection for this query — see [Localization](./i18n.md#per-query-overrides).           |

HTTP-client-only options for [server-side rendering](./rich-content.md#server-side-rendering-through-the-http-client):
`contentAs` (`"html"` \| `"markdown"`), `htmlOptions`, `markdownOptions`.

## Filters

Filter helpers are attached to the query callable, so you build expressions inline:

```ts
const recent = await query("blogPost", {
  filter: (p) =>
    query.and(
      query.eq(p.status, "published"),
      query.gte(p.$publishedAt, Date.now() - 7 * 24 * 60 * 60 * 1000),
    ),
  sort: "-$publishedAt",
});

const matchingTitles = await query("blogPost", { search: "release" });
```

`search` is a convenience shortcut for simple title searches. For any other field or
compound condition, use `filter`.

Available filter-expression helpers:

| Helper                      | Meaning                                 |
| --------------------------- | --------------------------------------- |
| `eq` / `ne`                 | Equal / not equal.                      |
| `gt` / `gte` / `lt` / `lte` | Numeric and timestamp comparisons.      |
| `like` / `notLike`          | Pattern match / negated pattern match.  |
| `contains`                  | Membership in an array-valued property. |
| `and` / `or`                | Combine sub-expressions.                |
| `linksTo` / `linkedFrom`    | Traverse relationships — see below.     |

There is no separate “property is one of these values” helper; combine `eq` clauses with
`or` for that shape.

[System properties](./system-properties.md) (`$publishedAt`, `$createdAt`, `$changedAt`,
`$id`, `$collection`, `$locale`) are filterable and sortable like any other field.

## Relations

Model relationships as `ref[]` properties ([Collections](./collections.md#property-types)).
Query across them in two directions:

- `linksTo` — items that reference a given target.
- `linkedFrom` — items referenced by a given source.

Use `with` to fetch related items in the same query (nested relationship queries), and
`include: ["links"]` / `include: ["files"]` to expand referenced items or files.

The `all(collection, filterOrOptions?)` and `oneOf(collection, filterOrOptions?)` helpers
build nested `with` entries. `all` returns an array relation, while `oneOf` marks the
relation as `single: true` and returns the first matching item or `null`:

```ts
const posts = await query("blogPost", {
  with: (post) => ({
    author: query.oneOf("author", (author) => query.eq(author.$id, post.author)),
    relatedPosts: query.all("blogPost", (other) => query.ne(other.$id, post.$id)),
  }),
});
```

## Pagination

Use `limit` + `offset` for offset pagination. The returned `QueryResultArray` carries a
`meta` object with the totals needed to drive paging UI:

```ts
const page = await query("blogPost", { limit: 20, offset: 40, sort: "-$changedAt" });
page.forEach(renderRow);
const { meta } = page;
```

## Typed queries

Generate types and pass `Collections` as the client generic so collection names, props,
filters, and sorts are all type-checked:

```bash
contfu integrations types <app-integration-id> > src/types/contfu.ts
```

```ts
import { contfuClient } from "@contfu/client";
import type { Collections } from "./types/contfu";

const basicAuth = process.env.CONTFU_BASIC_AUTH;
export const cq = contfuClient<Collections>(
  process.env.CONTFU_SERVER_URL!,
  undefined,
  basicAuth ? { basicAuth } : {},
);

// `"blogPost"` is checked against Collections; `p.title` is typed.
const posts = await cq("blogPost", { filter: (p) => cq.like(p.title, "%release%") });
```

The embedded client is generic the same way: `contfu<Collections>()`.

Regenerate types after changing collections, mappings, or [active
locales](./i18n.md#active-locales). See [Collections → Generated
types](./collections.md#generated-types).

## A shared module, not per-call clients

Create the query client **once** in a central data module and import it wherever content
is fetched. Do not instantiate a fresh client per route, page, or component:

```ts
// src/lib/server/contfu.ts
import { contfuClient } from "@contfu/client";
import type { Collections } from "../types/contfu";

const basicAuth = process.env.CONTFU_BASIC_AUTH;
export const cq = contfuClient<Collections>(
  process.env.CONTFU_SERVER_URL!,
  undefined,
  basicAuth ? { basicAuth } : {},
);
```

Framework placement:

- **SvelteKit** — `+page.server.ts` / `+layout.server.ts` load functions.
- **Next.js** — Server Components, `getServerSideProps`, or `getStaticProps`.
- **Astro** — `.astro` frontmatter or API routes.
- **Plain Node/Bun** — anywhere on the server; use
  [`@contfu/connect`](./deployment.md#embedded-runtime) for live updates.

## Localized queries

Set a default locale and fallback when creating the client, override per query, or derive a
request-scoped client with `withLocale`:

```ts
const localized = cq.withLocale(requestLocale, "en");
const posts = await localized("blogPost");
```

`fallback: true` means “use the configured default locale”; inherited unresolved `true` fallbacks are ignored.
Full model and examples: [Localization & i18n](./i18n.md).

## The CLI as a query client

You can run queries from the terminal against a running Server — handy for debugging:

```bash
contfu items query -u <server-url> --collection blogPost --search release --sort -$changedAt --limit 5
contfu items query -u <server-url> --collection blogPost --locale fr --fallback en
contfu items count -u <server-url> --collection blogPost --search release
```

See [CLI reference → Item queries](./cli.md#item-queries).
