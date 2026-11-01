# Notion Integration Reference

## File Structure

```
packages/service/integrations/src/notion/
├── index.ts                        # Exports
├── notion-integration.ts    # Main Integration implementation
├── notion.ts                       # Types (NotionFetchOpts)
├── notion-items.ts                 # Item iteration and parsing
├── notion-blocks.ts                # Content block transformation
├── notion-collections.ts           # Schema extraction
└── notion-helpers.ts               # API utilities, pagination
```

## NotionIntegration Implementation

```typescript
import { IntegrationType, type Item } from "@contfu/core";
import type { CollectionSchema } from "@contfu/svc-core";
import {
  IntegrationSyncMethod,
  PullCursor,
  PushGapDetection,
  PushTransport,
  type Integration,
} from "../integration";
import type { NotionFetchOpts } from "./notion";
import { getCollectionSchema } from "./notion-collections";
import { iteratePages } from "./notion-items";

export class NotionIntegration implements Integration<NotionFetchOpts> {
  type = IntegrationType.NOTION;
  syncCapabilities = [
    {
      method: IntegrationSyncMethod.PUSH,
      transport: PushTransport.WEBHOOK,
      gapDetection: PushGapDetection.NONE,
    },
    {
      method: IntegrationSyncMethod.IPULL,
      cursor: PullCursor.TIMESTAMP,
      serverSideFilter: true,
      includesVersions: true,
      safetyLagMs: 10_000,
    },
    { method: IntegrationSyncMethod.FPULL, detectsDeletes: true },
  ];

  fetchIncremental(opts: NotionFetchOpts & { since: number }): AsyncGenerator<Item> {
    // Buffer 10 seconds to avoid timestamp race conditions.
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    return pull(opts, createdOrUpdated(opts.since, until));
  }

  fetchFull(opts: NotionFetchOpts): AsyncGenerator<Item> {
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    return pull(opts, onOrBefore(until));
  }

  async getCollectionSchema(opts: NotionFetchOpts): Promise<CollectionSchema> {
    return getCollectionSchema(opts.credentials, opts.ref);
  }
}
```

## Item Parsing

```typescript
function parseItem(page: PageObjectResponse, collection: number, content?: Block[]): Item {
  const props = parseProps(page.properties);

  if (page.icon && page.icon.type !== "emoji") props.icon = getImageUrl(page.icon);
  if (page.cover) props.cover = getImageUrl(page.cover);

  return {
    id: genUid(uuidToBuffer(page.id)),
    ref: uuidToBuffer(page.id),
    collection,
    createdAt: new Date(page.created_time).getTime(),
    changedAt: new Date(page.last_edited_time).getTime(),
    props,
    content: content?.length ? content : undefined,
  };
}
```

## Property Type Mapping

| Notion Type      | Contfu Type | Notes                  |
| ---------------- | ----------- | ---------------------- |
| title            | string      | Concatenate rich text  |
| rich_text        | string      | Concatenate plain text |
| number           | number      | Direct                 |
| date             | number      | Unix timestamp (ms)    |
| select           | string      | Option name            |
| multi_select     | string[]    | Option names           |
| checkbox         | boolean     | Direct                 |
| url              | string      | Direct                 |
| email            | string      | Direct                 |
| phone_number     | string      | Direct                 |
| relation         | Buffer[]    | Referenced item IDs    |
| files            | string[]    | File URLs              |
| status           | string      | Status name            |
| created_time     | number      | Unix timestamp         |
| last_edited_time | number      | Unix timestamp         |

```

```
