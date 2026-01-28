# Notion Adapter Reference

## File Structure

```
packages/service/sync/src/sources/notion/
├── index.ts              # Exports
├── notion-source.ts      # Main Source implementation
├── notion.ts             # Types (NotionFetchOpts)
├── notion-items.ts       # Item iteration and parsing
├── notion-blocks.ts      # Content block transformation
├── notion-collections.ts # Schema extraction
└── notion-helpers.ts     # API utilities, pagination
```

## NotionSource Implementation

```typescript
// notion-source.ts
import { CollectionSchema, Item } from "@contfu/core";
import { Source } from "../source";
import { NotionFetchOpts } from "./notion";
import { getCollectionSchema } from "./notion-collections";
import { iteratePages } from "./notion-items";

export class NotionSource implements Source<NotionFetchOpts> {
  fetch(opts: NotionFetchOpts): AsyncGenerator<Item> {
    // Buffer 10 seconds to avoid timestamp race conditions
    const until = Math.floor(Date.now() / 1000 - 10) * 1000;
    return opts.since
      ? pull(opts, createdOrUpdated(opts.since, until))
      : pull(opts, onOrBefore(until));
  }

  async getCollectionSchema(opts: NotionFetchOpts): Promise<CollectionSchema> {
    return getCollectionSchema(opts.credentials, opts.ref);
  }
}

function pull(opts: NotionFetchOpts, filter?: DbQuery["filter"]) {
  return iteratePages(opts, {
    filter,
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
}
```

## Item Parsing

```typescript
// notion-items.ts
function parseItem(page: PageObjectResponse, collection: number, content?: Block[]): Item {
  const props = parseProps(page.properties);

  // Handle icon and cover
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

## Pagination Pattern

```typescript
async function* iterateDb(credentials: Buffer, dbId: Buffer, params: DbQuery) {
  let startCursor: string | undefined;

  do {
    const response = await notion.databases.query({
      database_id: bufferToUuid(dbId),
      ...params,
      start_cursor: startCursor,
    });

    for (const page of response.results) {
      if (page.object === "page") yield page;
    }

    startCursor = response.has_more ? response.next_cursor : undefined;
  } while (startCursor);
}
```

## Incremental Sync

Uses timestamps for incremental sync:

```typescript
function createdOrUpdated(since: number, until: number) {
  return {
    and: [
      {
        timestamp: "created_time",
        created_time: {
          after: formatDate(since),
          on_or_before: formatDate(until),
        },
      },
    ],
  };
}
```
