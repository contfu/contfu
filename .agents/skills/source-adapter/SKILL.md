---
name: source-adapter
description: Create new CMS source adapters for Contfu. Use when adding support for a new CMS platform (Contentful, Sanity, WordPress, Ghost, Directus, etc.), implementing the Source interface, handling pagination, transforming content blocks, or debugging sync issues with existing adapters.
---

# Source Adapter Development

Create adapters that sync content from CMS platforms into Contfu.

## Source Interface

All adapters implement this interface in `packages/service/sync/src/sources/`:

```typescript
interface Source<T extends CollectionFetchOpts = CollectionFetchOpts> {
  fetch(opts: T): AsyncGenerator<Item>;
  getCollectionSchema(opts: T): Promise<CollectionSchema>;
}

type CollectionFetchOpts = {
  collection: number;
  ref?: Buffer; // Upstream collection reference
  url?: string; // API URL (self-hosted sources)
  credentials?: Buffer; // API key or token
  since?: number; // Incremental sync cursor
};
```

## Directory Structure

```
packages/service/sync/src/sources/
├── source.ts              # Base interface
├── notion/
│   ├── index.ts           # Exports
│   ├── notion-source.ts   # Source implementation
│   ├── notion.ts          # Types and fetch opts
│   ├── blocks.ts          # Block transformation
│   └── properties.ts      # Property transformation
└── strapi/
    ├── index.ts
    ├── strapi-source.ts
    ├── strapi.ts
    └── blocks.ts
```

## Implementation Checklist

1. **Create directory**: `packages/service/sync/src/sources/{cms-name}/`
2. **Define fetch options**: Extend `CollectionFetchOpts` with CMS-specific fields
3. **Implement `fetch()`**: Yield `Item` objects, sorted by `createdAt` ascending
4. **Implement `getCollectionSchema()`**: Return property definitions
5. **Handle pagination**: Use async generators for memory efficiency
6. **Transform blocks**: Convert CMS blocks to Contfu's `ContentBlock` format
7. **Export from index.ts**: `export { CmsSource } from "./cms-source"`

## Content Block Types

Transform CMS content to these block types (from `@contfu/core`):

```typescript
type ContentBlock =
  | { type: "paragraph"; content: RichText[] }
  | { type: "heading_1" | "heading_2" | "heading_3"; content: RichText[] }
  | {
      type: "bulleted_list_item" | "numbered_list_item";
      content: RichText[];
      children?: ContentBlock[];
    }
  | { type: "code"; content: RichText[]; language?: string }
  | { type: "quote"; content: RichText[] }
  | { type: "image"; url: string; caption?: RichText[] }
  | { type: "divider" }
  | { type: "table"; rows: TableRow[] };
```

## Example: Minimal Adapter

```typescript
import type { Source, CollectionFetchOpts } from "../source";
import type { Item, CollectionSchema } from "@contfu/core";

export interface MyFetchOpts extends CollectionFetchOpts {
  spaceId: string;
}

export class MySource implements Source<MyFetchOpts> {
  async *fetch(opts: MyFetchOpts): AsyncGenerator<Item> {
    const client = new MyClient(opts.credentials);
    let cursor = opts.since;

    while (true) {
      const { items, nextCursor } = await client.getItems({ cursor });
      for (const raw of items) {
        yield this.transformItem(raw, opts.collection);
      }
      if (!nextCursor) break;
      cursor = nextCursor;
    }
  }

  async getCollectionSchema(opts: MyFetchOpts): Promise<CollectionSchema> {
    const contentType = await client.getContentType(opts.ref);
    return { properties: this.transformSchema(contentType.fields) };
  }

  private transformItem(raw: any, collection: number): Item {
    return {
      collection,
      id: raw.id,
      ref: Buffer.from(raw.sys.id),
      createdAt: new Date(raw.sys.createdAt).getTime(),
      changedAt: new Date(raw.sys.updatedAt).getTime(),
      properties: this.transformProperties(raw.fields),
      content: this.transformContent(raw.fields.body),
    };
  }
}
```

## Reference Files

- **[references/notion-adapter.md](references/notion-adapter.md)** — Full Notion adapter implementation
- **[references/strapi-adapter.md](references/strapi-adapter.md)** — Full Strapi adapter implementation
- **[references/block-mapping.md](references/block-mapping.md)** — CMS block type mappings

## Testing

```bash
cd packages/service/sync
bun test src/sources/{cms-name}/
```

Write tests for:

- Pagination handling
- Block transformation edge cases
- Error handling (rate limits, auth failures)
- Incremental sync (`since` parameter)
