# Client SDK Setup

Use this reference when the project needs real query code, generated types, or replacement of mock content with live Contfu data.

## Installation

```bash
npm install @contfu/client
# or
bun add @contfu/client
```

For real-time sync (server-side only):

```bash
npm install @contfu/connect
```

## Environment variables

Add to `.env` (or your framework's env config):

```
CONTFU_KEY=<your-client-api-key>
```

The API key comes from creating an app connection (see `ref-project-setup.md` step 2). `contfu setup` writes this automatically when `--env-file` is passed.

When using `@contfu/client` (HTTP mode), also add the URL of the user's `@contfu/server` instance:

```
CONTFU_SERVER_URL=<user-provided server URL>
```

This is not needed for `@contfu/contfu` (local sync mode).

## HTTP query client

For querying content from any environment (browser, server, edge):

```typescript
import { createHttpTypedClient } from "@contfu/client";

const contfu = createHttpTypedClient(
  process.env.CONTFU_SERVER_URL!,
  process.env.CONTFU_KEY!
);

// Query items from a collection
const posts = await contfu.items.query({
  collection: "blog-posts",
  limit: 10,
  sort: "-$changedAt",
});

// Count items
const total = await contfu.items.count({
  collection: "blog-posts",
});
```

If the repo uses a local Contfu database instead of HTTP, instantiate the local typed client from `@contfu/contfu` instead of `@contfu/client`.

### Query options

| Option | Description |
|--------|-------------|
| `collection` | Collection name (slug) |
| `filter` | Filter expression using helpers: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `like`, `contains`, `and`, `or`, `linksTo`, `linkedFrom` |
| `sort` | Comma-separated fields, prefix `-` for desc (e.g., `-$changedAt,title`) |
| `limit` | Max items to return |
| `offset` | Skip N items (pagination) |
| `fields` | Comma-separated field names to include |
| `include` | Include related data (`assets`, `links`) |
| `with` | Nested relationship queries |
| `flat` | Flatten nested properties |

## Stream client (real-time sync)

For server-side apps that need live content updates:

```typescript
import { connect } from "@contfu/connect";

for await (const event of connect({
  key: Buffer.from(process.env.CONTFU_KEY!, "base64url"),
  connectionEvents: true,
})) {
  switch (event.type) {
    case "item-changed":
      console.log("Updated:", event.item);
      break;
    case "item-deleted":
      console.log("Deleted:", event.ref);
      break;
    case "stream-connected":
      console.log("Connected to sync stream");
      break;
  }
}
```

## Type generation

Generate TypeScript types for type-safe queries:

```bash
# Types for all collections connected to an app connection
contfu connections types <app-connection-id>

# Types for a single collection
contfu collections types <collection-id>
```

Save the output to your project:

```bash
contfu connections types <id> > src/types/contfu.ts
```

Prefer connection-wide types for app integrations so the client can query every collection the app connection can see. Re-run generation before writing or updating query code if collections or mappings changed.

Set up the query builder once in a central module, and populate its generic with the generated `Collections` type. Import that shared query builder wherever content is fetched.

For an HTTP-backed app:

```typescript
// src/lib/server/contfu.ts
import { createHttpTypedClient } from "@contfu/client";
import type { Collections } from "./types/contfu";

export const cq = createHttpTypedClient<Collections>(
  process.env.CONTFU_SERVER_URL!,
  process.env.CONTFU_KEY!
);
```

For local database access:

```typescript
// src/lib/server/contfu.ts
import { contfu } from "@contfu/contfu";
import type { Collections } from "./types/contfu";

export const cq = contfu<Collections>();
```

Then import that central module where content is needed:

```typescript
import { cq } from "$lib/server/contfu";

const posts = await cq("blogPosts", { limit: 10 });
```

## Replace mock content with live queries

When setup is happening inside an existing app, do not stop after package installation.

1. Search the repo for mock arrays, placeholder fixtures, static demo cards, or temporary loaders that represent content now available in Contfu.
2. Trace where those values enter the UI.
3. Generate or refresh the Contfu `Collections` types with the CLI.
4. Create or update the central typed Contfu query-builder module in the project's normal server/data layer.
5. Replace the placeholder path with real queries by importing that shared module where needed.
6. Delete the obsolete mock data and unused imports.

Good candidates include:

- hardcoded `events`, `posts`, `projects`, or `authors` arrays
- fixture files imported only to render content lists
- TODO comments saying to "replace with CMS" or "wire up real data later"

Prefer a focused query that matches the screen's purpose, for example:

```typescript
const events = await cq("events", {
  limit: 20,
  sort: "startDate",
});
```

If the query belongs in a route loader, server component, or shared repository module, keep it there. Avoid moving data fetching into the view layer unless the project already follows that pattern.
Do not instantiate fresh Contfu clients in each consumer file when a shared typed query-builder module can be imported instead.

## Framework integration tips

- **SvelteKit**: Use in `+page.server.ts` or `+layout.server.ts` load functions
- **Next.js**: Use in `getServerSideProps`, `getStaticProps`, or Server Components
- **Astro**: Use in `.astro` frontmatter or API routes
- **Plain Node/Bun**: Use `@contfu/connect` for real-time sync to a local database
