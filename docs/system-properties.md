# System properties

Contfu normalizes a small set of cross-Service metadata into reserved, `$`-prefixed **system properties**. They give applications a stable contract for things like identity, publishing state, and timestamps without having to know whether the content came from Contentful, Notion, Sanity, Strapi, or WordPress.

System properties are distinct from your content fields:

- They always start with `$`, so they never collide with Service field names.
- They are normalized: the same property means the same thing across every Service.
- They are additive and hidden — they do not replace the original Service data, and a Service only contributes the ones it actually exposes.

Service traceability such as the upstream ref is not emitted unless you model it deliberately
as a collection property. Service Integration type remains Contfu context and is not a
built-in application system property.

## Reference

| Property       | Type           | Meaning                                                                                                                           | Filterable |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `$id`          | number         | Stable item identifier within its collection.                                                                                     | yes        |
| `$collection`  | string         | The collection the item belongs to.                                                                                               | yes        |
| `$changedAt`   | number         | Upstream version timestamp — when the item last changed in the source. Drives incremental sync and is the default sort.           | yes        |
| `$createdAt`   | number         | When the source created the item.                                                                                                 | yes        |
| `$publishedAt` | number \| null | When the source published the item. `null`/absent for unpublished items.                                                          | yes        |
| `$locale`      | string         | Normalized BCP 47 locale of a localized item variant. See [Localization](./i18n.md).                                              | yes        |
| `$draft`       | boolean        | Present on draft-capable item collections; `true` when the item is a draft. Missing values are treated as `false` when filtering. | yes        |

All timestamp values (`$changedAt`, `$createdAt`, `$publishedAt`) are **epoch milliseconds** (the same units as `Date.now()`), so they compare and sort numerically.

## System timestamps

Contfu exposes Service timestamps under three normalized properties. They answer different questions, so applications can build publishing feeds, audits, and incremental jobs without special-casing each Service:

- **`$createdAt`** — when the item was created in the source.
- **`$publishedAt`** — when the item was published in the source. It is `null` (or absent) for drafts and for items the source has never published.
- **`$changedAt`** — when the item last changed in the source. This is the upstream "last updated" time. It is also the value Contfu uses as its sync cursor and as the default sort order.

There is deliberately no separate `$updatedAt`: `$changedAt` already carries the upstream update/version time, so a dedicated "updated" property would just duplicate it.

### Availability by Service

Each Service contributes only the timestamps it actually reports:

| Service    | `$createdAt`                  | `$publishedAt`      | `$changedAt`             |
| ---------- | ----------------------------- | ------------------- | ------------------------ |
| Contentful | yes                           | yes                 | yes (`sys.updatedAt`)    |
| Notion     | yes (`created_time`)          | — (no publish time) | yes (`last_edited_time`) |
| Sanity     | yes                           | — (no publish time) | yes (`_updatedAt`)       |
| Strapi     | yes                           | yes                 | yes (`updatedAt`)        |
| WordPress  | — (no distinct creation time) | yes (`date_gmt`)    | yes (`modified_gmt`)     |

Sanity models publishing structurally rather than with a timestamp, so it has no `$publishedAt`. WordPress has no creation timestamp separate from its publish date, so it has no `$createdAt`. In both cases the missing property is simply absent — Contfu does not synthesize a value, because the source is the system of record.

Services that expose their own raw timestamp fields (for example WordPress `dateGmt` and `modifiedGmt`) still deliver those as ordinary content properties. Prefer the normalized `$`-properties for portable application code, and reach for the raw fields only when you need the exact Service representation.

### Notion migration

Notion page-level `created_time` is now exposed as `$createdAt`. This replaces the former synthetic `createdAt` property. A real Notion database property named **Created At** remains the ordinary `createdAt` field (and **Last Edited At** remains `lastEditedAt`); neither is promoted to system metadata. Refresh or resync affected Notion source collections, then regenerate application types and migrate mappings, filters, and consumers from the former synthetic `createdAt` to `$createdAt`.

## Querying

System properties work with the typed query builder like any other field. Filterable properties can appear in filters, and the timestamps sort numerically.

```ts
import { contfu } from "@contfu/contfu";

const { query } = contfu();

// Items published in the last 24 hours, newest first.
const since = Date.now() - 24 * 60 * 60 * 1000;
const recent = await query("blogPost", {
  filter: (p) => query.gte(p.$publishedAt, since),
  sort: "-$publishedAt",
});

// Items created before a cutoff.
const cutoff = Date.parse("2026-01-01T00:00:00Z");
const older = await query("blogPost", {
  filter: (p) => query.lt(p.$createdAt, cutoff),
});

// In a draft-inclusive collection, select drafts or published items.
const drafts = await query("blogPost", { filter: (p) => query.eq(p.$draft, true) });
const published = await query("blogPost", { filter: (p) => query.eq(p.$draft, false) });
const publishedFromString = await query("blogPost", { filter: "$draft = false" });
// An item without `$draft` is included by both the typed and string false filters.

// Sort by creation time ascending.
const byCreated = await query("blogPost", { sort: "$createdAt" });
```

The same properties are available through the HTTP client (`@contfu/client`); see [Localization](./i18n.md) for client and server setup examples.

## Generated types

When a collection exposes them, the normalized props appear on its generated item type:

```ts
type BlogPost = {
  title: string;
  // …content fields…
  $createdAt: number;
  $publishedAt: number | null;
};
```

`$changedAt` is available on every item regardless of Service. Regenerate types after changing a collection's source so newly available system properties are reflected in your application contract.
