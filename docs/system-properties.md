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
| `$changedAt`   | number         | Upstream version timestamp, or fetch time for Web without `Last-Modified`. Drives incremental sync and is the default sort.       | yes        |
| `$createdAt`   | number         | When the source created the item.                                                                                                 | yes        |
| `$publishedAt` | number \| null | When the source published the item. `null`/absent for unpublished items.                                                          | yes        |
| `$scheduledAt` | number \| null | Planned publication time, not evidence of publication; absent when no schedule is exposed.                                        | yes        |
| `$scope`       | string         | Source collection scope name; absent for unscoped items. Derived by Contfu, not supplied by source content.                       | yes        |
| `$locale`      | string         | Normalized BCP 47 locale of a localized item variant. See [Localization](./i18n.md).                                              | yes        |
| `$draft`       | boolean        | Present on draft-capable item collections; `true` when the item is a draft. Missing values are treated as `false` when filtering. | yes        |

All timestamp values (`$changedAt`, `$createdAt`, `$publishedAt`, `$scheduledAt`) are **epoch milliseconds** (the same units as `Date.now()`), so they compare and sort numerically.

## Source scope

`$scope` is the name stored on the item's **source collection**, for example a Contentful
environment, Sanity dataset, or GitHub branch. It is applied after content mappings at
application delivery: neither source fields nor mappings can spoof it. It is absent (not
`null` or an empty placeholder) for unscoped sources. Multiple inflows can deliver different
scopes into the same name-based application collection. Generated item types always include
`$scope?: string`.

```ts
const staging = await query("blogPost", { filter: (p) => query.eq(p.$scope, "staging") });
const production = await query("blogPost", { filter: '$scope = "production"' });
const unscoped = await query("blogPost", { filter: "$scope = null" });
```

Managed source identity includes the service connection, scope, and native key. The same
native document in two scopes therefore has two distinct managed IDs; `$scope` is metadata,
not part of the application's collection identity.

## System timestamps

Contfu exposes Service timestamps under four normalized properties. They answer different questions, so applications can build publishing feeds, audits, and incremental jobs without special-casing each Service:

- **`$createdAt`** — when the item was created in the source.
- **`$scheduledAt`** — the earliest pending publication of the synchronized version. Available for supported WordPress, Contentful, Sanity, and Strapi schedules with draft sync and the required access; see [Planned publication](./integrations.md#planned-publication). It is optional in generated types (`$scheduledAt?: number`) and supports filters such as `query.gte(p.$scheduledAt, Date.now())` or `$scheduledAt >= 1700000000000`. Reaching this time does not mean the item has been published.
- **`$publishedAt`** — when the item was published in the source. It is `null` (or absent) for drafts and for items the source has never published.
- **`$changedAt`** — when the item last changed in the source. This is the upstream "last updated" time, except for Web's fetch-time fallback described below. It is also the value Contfu uses as its sync cursor and as the default sort order.

There is deliberately no separate `$updatedAt`: `$changedAt` already carries the upstream update/version time, so a dedicated "updated" property would just duplicate it.

### Availability by Service

Each Service contributes only the timestamps it actually reports:

| Service    | `$createdAt`                  | `$publishedAt`             | `$changedAt`                                  |
| ---------- | ----------------------------- | -------------------------- | --------------------------------------------- |
| Contentful | yes                           | yes                        | yes (`sys.updatedAt`)                         |
| Notion     | yes (`created_time`)          | — (no publish time)        | yes (`last_edited_time`)                      |
| Sanity     | yes                           | — (no publish time)        | yes (`_updatedAt`)                            |
| Strapi     | yes                           | yes                        | yes (`updatedAt`)                             |
| WordPress  | — (no distinct creation time) | yes (published `date_gmt`) | yes (effective modification/publication time) |
| Web        | — (no creation time)          | — (no publish time)        | HTTP `Last-Modified`, otherwise fetch time    |

A Service may offer scheduling in its editor without exposing the planned time through its Contfu integration. Contfu does not infer `$scheduledAt` from custom date fields or use it to publish content; publication remains controlled by the source.

Sanity models publishing structurally rather than with a timestamp, so it has no `$publishedAt`. WordPress has no creation timestamp separate from its publish date, so it has no `$createdAt`. In both cases the missing property is simply absent — Contfu does not synthesize a value, because the source is the system of record.

Services that expose their own raw timestamp fields (for example WordPress `dateGmt` and `modifiedGmt`) still deliver those as ordinary content properties. Prefer the normalized `$`-properties for portable application code, and reach for the raw fields only when you need the exact Service representation.

Web provides no adapter-generated creation, publication, or scheduled timestamp: `$createdAt`,
`$publishedAt`, and `$scheduledAt` remain absent. HTTP `Last-Modified` supplies `changedAt`
(delivered as `$changedAt`) when available; otherwise it is the current fetch time. Neither
value is a creation or publication time. Fetch time can change on every pull, while the
content fingerprint remains stable for unchanged pages without cache headers. Conditional
validators and unchanged-page suppression are independent of creation metadata.

### Web migration

The former undocumented, synthetic Web `createdAt` property has been removed. There is no
replacement creation field; do not migrate it to `$createdAt`. Review mappings, filters,
sorting, and application consumers that read it, and regenerate application types as needed.
A JSON source field named `createdAt` explicitly declared by a discovered schema remains
ordinary content with its original value, not system metadata. Legacy JSON `data` continues
to contain the original response as a string.

Deployment alone does not remove synthetic values already cached or delivered downstream.
The legacy fingerprint exclusion for `createdAt` is retained, so removing the field does not
produce a new version; an unchanged poll or an HTTP 304 response (including on a conditional
full pull) may leave old values in place. Use the supported full source and application
resync workflow to rebuild affected cached items and downstream stores from fresh payloads.
A routine unchanged refresh is not a cleanup guarantee.

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
