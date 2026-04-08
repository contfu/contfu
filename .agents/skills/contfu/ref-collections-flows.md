# Collections & Flows

## Collections

Collections are named content buckets that hold synced items. Each collection has a schema that describes its fields.

### Create a collection

```bash
contfu collections create --display-name "Blog Posts"
# Optional: --name blog-posts (auto-derived if omitted)
# Optional: --connection-id <client-id> (associate with a app connection)
# Optional: --include-ref (include source reference IDs in synced items)
```

When operating in a project/client context, always pass `--connection-id <client-id>` so the collection is associated with the client. The client ID comes from the connection created in the setup step.
When extending an existing app integration, reuse the existing app connection ID so the new collection is visible to the same app.

### List & inspect

```bash
contfu collections list
contfu collections list -f json
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

A flow connects a **source collection** (from a CMS connection) to a **target collection**. When the CMS data changes, the flow syncs updates into the target collection.

### Finding source collection IDs

Source collections must be **imported via the web UI** before they have numeric IDs. `contfu discover` only shows what's available (UUID refs) — it does not import.

To import:
1. Go to `https://contfu.com/connections/<cms-connection-id>` in the browser
2. Import the needed databases/content types
3. After import, numeric IDs are available:

```bash
contfu connections get <cms-connection-id>
```

Each imported source collection in the response has an `id` field — use that as `--source-id`. **Never use UUID refs as `--source-id`** — the CLI expects numeric IDs only.

### Create a flow

```bash
contfu flows create --source-id <source-collection-id> --target-id <target-collection-id>
```

Options:

- `--include-ref` / `--no-include-ref` — whether to include source reference data
- `-d <json>` — raw JSON body for advanced configuration

### List & inspect

```bash
contfu flows list
contfu flows get <id>
```

### Delete

```bash
contfu flows delete <id>
```

## Common patterns

### One CMS database → one collection

The simplest setup. One Notion database flows into one Contfu collection:

```bash
contfu collections create --display-name "Blog Posts" --connection-id <client-id>
contfu flows create --source-id <notion-db-id> --target-id <collection-id>
```

### Add another collection to an existing app connection

When the app is already integrated and you need one more content bucket:

```bash
contfu collections create --display-name "Events" --connection-id <existing-app-id>
contfu flows create --source-id <source-collection-id> --target-id <events-collection-id>
contfu connections types <existing-app-id> > src/types/contfu.ts
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
