# Collections & Schemas

A **collection** is a named bucket of content **items**. Your application queries
collections; flows fill them. Each collection has exactly one **schema** describing the
shape of its items.

## Collection kinds

| Kind          | Meaning                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| **Connected** | Directly attached to an integration. Source collections imported from a provider are connected collections. |
| **Virtual**   | Not attached to any integration — a target bucket you define yourself and fill via flows.                   |
| **Linked**    | Participates in at least one flow (has an inflow or outflow).                                               |
| **Localized** | Its items may have per-locale variants. See [Localization](./i18n.md).                                      |

In practice you work with two roles: **source collections** (imported from a provider, see
[Integrations](./integrations.md#discover-and-import-source-collections)) and **target
collections** (the buckets your app reads). A [flow](./flows.md) connects the two.

## Items

An item is a single entry in a collection. Every item carries:

- a stable identity and the collection it belongs to;
- normalized [system properties](./system-properties.md) (`$id`, `$collection`,
  `$changedAt`, `$createdAt`, `$publishedAt`, `$locale`, `$draft`);
- structured **props** (the typed fields described by the schema);
- optional rich **content** blocks for long-form prose (see
  [Rich content](./rich-content.md)).

Model **props** for metadata, taxonomy, references, settings, media URLs, and anything you
query or route by. Model **content blocks** for long-form rich text: headings, lists,
code, callouts, media embeds, tables, and nested prose.

## Create and manage target collections

```bash
contfu collections create --display-name "Blog Posts" --integration-id <app-integration-id>
# --name blog-posts        # camelCase slug, auto-derived if omitted
# --include-ref            # keep source reference IDs on synced items
```

```bash
contfu collections list -f json
contfu collections get <id>
contfu collections update <id> --display-name "Articles"
contfu collections update <id> --name new-slug
contfu collections delete <id>
```

### Associating collections with an app

A collection is only visible to an application when it is associated with that app's
integration. Check the `integrationId` field:

```bash
contfu collections list -f json
```

A collection with `"integrationId": null` is standalone — the app cannot see it. Create it
(or recreate it) with `--integration-id <app-integration-id>`. When extending an existing
app, reuse that same app integration ID so the new collection joins the same app contract.

## Schemas

A schema is the expected shape of a collection's items. It is one of:

- **Fixed Schema** — defined explicitly for the collection.
- **Derived Schema** — inferred from the collection's [flows](./flows.md): the union of its
  inflows' derived schemas, or a flow's identity schema from its source. If one inflow
  omits a property another provides, that property becomes optional/nullable. An
  incompatible type from an inflow **freezes** that flow rather than corrupting the schema.

### Property types

Each property is described by a **Native Property Type** — a Contfu-owned, normalized
value kind that generates a consistent application type across every provider. Native
property types define synchronization and query contracts; they intentionally do **not**
model provider editor widgets, field layout, or validation rules.

The property schema shape:

```ts
interface CollectionSchema {
  properties: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "color" | "string[]" | "number[]" | "ref[]";
      required?: boolean;
    };
  };
}
```

Native `color` values use Contfu's compact numeric representation: unsigned `0xRRGGBBAA`
(red in the most significant byte, alpha in the least significant byte). Generated
TypeScript exposes these fields as `Color` from `@contfu/core`; use the exported helpers
such as `colorFromHex`, `colorFromRgba`, `colorToHex`, and `colorToRgba` at application
boundaries.

Model relationships — including single relations — as `ref[]`. Prefer explicit, stable
fields such as `slug`, `publishedAt`, `order`, and relation refs when the app will query or
route by them.

## Components

A **Component** is a reusable structured content block with named props and nested
children — a custom block type that appears inside item content (a callout, a hero, a
product card). Components are first-class workspace resources, not specialized
collections.

Key rules:

- A component is **scoped to an ingress integration**, and its name is unique within that
  integration.
- The component name is delivered to applications as the **block discriminator**, so
  renaming a component is a **breaking application contract change**.
- An integration may auto-discover provider components and create unreviewed ones;
  unreviewed components still appear in generated types.
- Each component has one mapping from the ingress component shape to its internal props
  schema (identity by default). Component mappings run **before** collection/flow
  mappings, so downstream mappings see normalized block props.
- When multiple inflows forward same-named components, their prop schemas merge: equal
  schemas collapse into one block type; differing schemas produce a unioned block type for
  that runtime name.
- Incompatible component schema/mapping changes use the same
  [frozen-flow and incident model](./flows.md#incidents) as collections.

Components have their own detail pages, listed from their owning integration.

## Generated types

After modeling, generate the TypeScript contract your queries use:

```bash
contfu collections types <collection-id>            # one collection
contfu integrations types <app-integration-id>      # all collections an app sees
```

Save it into your project and feed the resulting `Collections` type to the query client as
its generic. Regenerate after changing collections, mappings, or active locales so the
application contract stays in sync. See [Querying](./querying.md#typed-queries).

## A note on modeling

When deciding how upstream content maps into Contfu:

1. Inventory the upstream content types/databases.
2. Map provider fields to native property types.
3. Decide which rich fields belong in `content` blocks vs. props.
4. Model references (and self-references) as `ref[]`.
5. Decide how media URLs are stored.
6. Confirm the sync capabilities you need (push, incremental, full pull).
