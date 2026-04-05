# Client SDK Setup

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
CONTFU_URL=https://app.contfu.com
CONTFU_API_KEY=<your-client-api-key>
```

The API key comes from creating a CLIENT connection (see `ref-project-setup.md` step 5).

## HTTP query client

For querying content from any environment (browser, server, edge):

```typescript
import { createHttpTypedClient } from "@contfu/client";

const contfu = createHttpTypedClient(
  process.env.CONTFU_URL!,
  process.env.CONTFU_API_KEY!
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
  key: Buffer.from(process.env.CONTFU_API_KEY!, "base64url"),
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
# Types for all collections connected to a client connection
contfu connections types <client-connection-id>

# Types for a single collection
contfu collections types <collection-id>
```

Save the output to your project:

```bash
contfu connections types <id> > src/types/contfu.ts
```

Then use with a typed client:

```typescript
import { createHttpTypedClient } from "@contfu/client";
import type { Collections } from "./types/contfu";

const contfu = createHttpTypedClient<Collections>(
  process.env.CONTFU_URL!,
  process.env.CONTFU_API_KEY!
);

// Now queries are typed against your schema
const posts = await contfu("blogPosts", { limit: 10 });
```

## Framework integration tips

- **SvelteKit**: Use in `+page.server.ts` or `+layout.server.ts` load functions
- **Next.js**: Use in `getServerSideProps`, `getStaticProps`, or Server Components
- **Astro**: Use in `.astro` frontmatter or API routes
- **Plain Node/Bun**: Use `@contfu/connect` for real-time sync to a local database
