# Collections & Flows

## Collections

Collections are named content buckets that hold synced items. Each collection has a schema that describes its fields.

### Create a collection

```bash
contfu collections create --display-name "Blog Posts"
# Optional: --name blog-posts (auto-derived if omitted)
# Optional: --integration-id <client-id> (associate with a app integration)
# Optional: --include-ref (include source reference IDs in synced items)
```

When operating in a project/client context, always pass `--integration-id <client-id>` so the collection is associated with the client. The client ID comes from the integration created in the setup step.
When extending an existing app integration, reuse the existing app integration ID so the new collection is visible to the same app.

### List & inspect

```bash
contfu collections list -a
contfu collections get <id>
```

### Update a collection

```bash
contfu collections update <id> --display-name "Articles"
contfu collections update <id> --name new-slug
```

### Delete

```bash
contfu collections delete <id>
```

## Flows

A flow connects a **source collection** (from a CMS integration) to a **target collection**. When the CMS data changes, the flow syncs updates into the target collection.

### Finding source collection IDs

Source collections must be imported before they have IDs. Scan and add them via the CLI:

```bash
contfu integrations scan <cms-integration-id> -a       # list available source collections
contfu integrations add <cms-integration-id> --all     # import all, or --refs <refs> for specific ones
```

After import, collection IDs are available:

```bash
contfu collections list -a
```

Each imported source collection has an `id` field — use that as `--source-id`.

### Create a flow

```bash
contfu flows create --source-id <source-collection-id> --target-id <target-collection-id>
```

Options:

- `--include-ref` / `--no-include-ref` — whether to include source reference data
- `-d, --data <json>` — raw JSON body for advanced configuration

### List & inspect

```bash
contfu flows list -a
contfu flows get <id>
```

### Delete

```bash
contfu flows delete <id>
```

## Flow schema

The flow's `schema` field stores the **source collection's schema** at the time the flow was created. The UI uses this to populate the source property dropdown in the mapping editor.

**Important**: When creating flows via the CLI or API, the `schema` must be set explicitly or the UI mapping editor will show empty dropdowns. Until this is fixed on the backend, always pass the source schema when creating flows programmatically:

```bash
contfu flows create --source-id <src> --target-id <tgt> \
  -d '{"schema":{"title":"string","body":"richtext"}}'
```

The schema value should match the source collection's schema (inspect with `contfu collections get <source-id>`).

## Common patterns

### One CMS database → one collection

The simplest setup. One Notion database flows into one Contfu collection:

```bash
contfu collections create --display-name "Blog Posts" --integration-id <client-id>
contfu flows create --source-id <notion-db-id> --target-id <collection-id>
```

### Add another collection to an existing app integration

When the app is already integrated and you need one more content bucket:

```bash
contfu collections create --display-name "Events" --integration-id <existing-app-id>
contfu flows create --source-id <source-collection-id> --target-id <events-collection-id>
contfu integrations types <existing-app-id> > src/types/contfu.ts
```

After that, update the app's shared `cq` module consumers to query the new collection where needed.

### Multiple sources → one collection

Merge content from multiple CMS databases into a single collection by creating multiple flows with the same target:

```bash
contfu flows create --source-id <notion-db-1> --target-id <collection-id>
contfu flows create --source-id <notion-db-2> --target-id <collection-id>
```

### One source → multiple collections

Not supported directly. Use one flow per source-target pair. If you need to split content, use different source collections or filter at query time.
