# Flows

A **flow** is a configured path that moves items from one **source collection** into one
**target collection**. When upstream content changes, the flow syncs the change into the
target — applying any **mappings** and **filters** along the way.

```
source collection ──flow──▶ target collection
       (Service)           (your app reads this)
```

- An **inflow** is a flow entering a collection.
- An **outflow** is a flow leaving a collection.
- A collection's [derived schema](./collections.md#schemas) is the union of its inflows'
  derived schemas.

## Create a flow

You need the **source** and **target** collection IDs. Source collections must be
[imported](./integrations.md#discover-and-import-source-collections) first so they have
IDs:

```bash
contfu collections list -f json     # find both numeric IDs
contfu flows create --source-id <source-collection-id> --target-id <target-collection-id>
```

Options:

- `-d, --data <json>` — raw JSON body for advanced configuration (mappings and filters). You can
  combine this with `--source-id`/`--target-id`, or include `sourceId` and `targetId` in the JSON.

Inspect and remove:

```bash
contfu flows list -f json
contfu flows get <flow-id>
contfu flows delete <flow-id>
```

## Mappings

A **mapping** translates item properties from the source collection's shape into the
target collection's shape. A flow with **no** mappings has an **identity** derived schema —
it carries the source schema through unchanged.

> Contfu records the source collection's schema when the flow is created, so the
> UI mapping editor can populate source-property dropdowns automatically. You do not need to
> pass a `schema` field in CLI/API flow create requests.
>
> A mapping `default` is used when the selected source value is null or missing (including an
> out-of-range array selection). The default is resolved before `cast` is applied. For example,
> `{ "source": "summary", "target": "description", "default": "No summary", "cast": "string" }`
> maps both a missing and a null `summary` to `"No summary"`, then applies the string cast. An
> omitted default preserves a null source; an explicit `"default": null` preserves null as the
> configured fallback.

## Filters

A **filter** decides whether an item passes through a flow. Filters affect _which_ items
flow, not the flow's derived schema — so adding or removing a filter never changes your
application's type contract.

## Common patterns

### One source → one collection

The simplest setup — one Service database into one Contfu collection:

```bash
contfu collections create --display-name "Blog Posts" --integration-id <app-id>
contfu flows create --source-id <source-db-id> --target-id <collection-id>
```

### Add another collection to an existing app

```bash
contfu collections create --display-name "Events" --integration-id <existing-app-id>
contfu flows create --source-id <source-collection-id> --target-id <events-collection-id>
contfu integrations types <existing-app-id> > src/types/contfu.ts
```

Then query the new collection from your shared client module.

### Many sources → one collection

Merge several Service databases into one collection by creating multiple flows with the
**same target**:

```bash
contfu flows create --source-id <source-1> --target-id <collection-id>
contfu flows create --source-id <source-2> --target-id <collection-id>
```

The target's derived schema becomes the union of both inflows. Same-named properties with
compatible types merge; incompatible types freeze the offending flow.

### One source → many collections

Not supported directly — use one flow per source/target pair. To split content, use
different source collections or [filter at query time](./querying.md).

## Incidents

When synchronization hits a problem it cannot safely resolve, Contfu raises a
user-visible **incident** rather than silently delivering bad data.

| Incident                   | What happened                                                   | Effect                                        |
| -------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| **External Schema Change** | A Source Role integration changed a source schema incompatibly. | The affected outflow **freezes**.             |
| **Mapping Failure**        | An item cannot be transformed by the flow's mappings.           | The item is **held**; the flow keeps running. |
| **Validation Failure**     | A parsed/mapped item does not satisfy the target schema.        | The item is **held**; the flow keeps running. |

The distinction matters:

- A **Frozen Flow** stops moving items entirely until you make a schema or mapping change.
  While frozen, it does **not** alter its target collection's schema — your application
  contract is protected.
- A **Held Item** is a single item withheld from delivery until the incident is resolved.
  The rest of the flow continues.

Paused and quota-blocked states do **not** automatically create incidents — they are
expected conditions, not failures.

### Deliberate schema changes

Schema changes you make on purpose are treated differently from external ones. Contfu
asks whether to freeze the affected flows or let the change propagate, rather than
freezing automatically.

## Refs and traceability

A **Ref** is a transient, service-side trace from an item back to its upstream Service
entry, used for incident investigation. It is **not** synchronized to your application by
default. If your app should receive Service traceability, model `$ref` as a normal
collection property.
