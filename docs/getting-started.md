# Getting Started

This walkthrough takes you from nothing to a typed query running in your application. It
uses Notion as the example source, but the shape is identical for any supported Service.

The path is always the same:

```
Connect a source → import source collections → register your app →
create target collections → wire flows → generate types → query
```

## Prerequisites

- A Contfu account at [contfu.com](https://contfu.com).
- The CLI. Install it globally, or call it ad-hoc:

  ```bash
  npm install -g @contfu/cli
  # or, without installing:
  bunx @contfu/cli <command>
  npx  @contfu/cli <command>
  ```

## 1. Authenticate

```bash
contfu login            # browser OAuth
contfu login --no-browser   # code flow, for headless/SSH
```

Check where you stand at any time:

```bash
contfu status -f json
```

This reports `authenticated`, plus your existing `integrations`, `collections`, and
`flows`. Everything below is incremental — re-running `status` tells you what is left.

## 2. Connect a content source

Integrations are created in the web UI (OAuth Providers authorize there; token Services
take an API token). The fastest path is a deep link with the type pre-selected:

```
https://contfu.com/integrations/new?type=notion
```

For Notion, authorize Contfu in the consent screen, then grant it access to the pages or
databases you want. For token Services (`strapi`, `contentful`, `web`) you can also
create the integration straight from the CLI:

```bash
contfu integrations types          # list available Service types
contfu integrations create --name "Marketing CMS" --type strapi --token <token>
```

Confirm it landed and grab its ID:

```bash
contfu integrations list -f json
```

See [Integrations](./integrations.md) for Service setup, scopes, and drafts.

## 3. Import source collections

Discover what the source exposes (Notion databases, Strapi content types, …):

```bash
contfu integrations scan <integration-id>
```

Import the ones you want so they get stable Contfu IDs:

```bash
contfu integrations add <integration-id> --refs <comma-separated-refs>
contfu integrations add <integration-id> --all       # everything
contfu integrations add <integration-id> --select    # interactive picker
```

## 4. Register your application

Create an **app integration** and install the package in one step. Do this before creating
target collections — you need the app integration's ID to associate collections with it.

```bash
contfu setup --non-interactive \
  --package @contfu/client \
  --app-name my-app \
  --env-file .env
```

- `--package @contfu/client` — for apps that query a remote Server (most cases). Use
  `@contfu/contfu` only for apps that embed the Contfu runtime directly.
- `--env-file .env` — writes `CONTFU_KEY=...` (the app API key) to the file.

Note the Application Integration's `id` from `contfu integrations list -f json`.

## 5. Create target collections

These are the buckets your application reads. Associate each with the app integration so
the app can see it:

```bash
contfu collections create --display-name "Blog Posts" --integration-id <app-integration-id>
```

> A collection with `"integrationId": null` is standalone — your app cannot see it.
> Always pass `--integration-id`.

See [Collections & schemas](./collections.md) for modeling guidance.

## 6. Wire a flow

A **flow** connects a source collection to a target collection. When upstream content
changes, the flow syncs it.

```bash
contfu collections list -f json        # find the source + target IDs
contfu flows create --source-id <source-collection-id> --target-id <target-collection-id>
```

Add mappings and filters when source and target shapes differ — see [Flows](./flows.md).

## 7. Generate types

```bash
contfu integrations types <app-integration-id> > src/types/contfu.ts
```

Prefer integration-wide types so the client can query every collection the app sees.
Regenerate after changing collections, mappings, or active locales.

## 8. Query from your application

Create one shared, typed query module and import it everywhere content is needed.

**HTTP (Server + Client):**

```ts
// src/lib/contfu.ts
import { contfuClient } from "@contfu/client";
import type { Collections } from "./types/contfu";

export const cq = contfuClient<Collections>(
  process.env.CONTFU_SERVER_URL!,
  process.env.CONTFU_KEY!,
);
```

**Embedded (Contfu runtime in-process):**

```ts
// src/lib/contfu.ts
import { contfu } from "@contfu/contfu";
import type { Collections } from "./types/contfu";

const { query: cq, events } = contfu<Collections>();
export { cq, events };
```

Either way the query call is identical:

```ts
import { cq } from "./lib/contfu";

const posts = await cq("blogPosts", {
  limit: 10,
  sort: "-$changedAt",
});
```

Full query reference: [Querying content](./querying.md).

## Where to go next

- Run the Contfu runtime or Server: [Deployment](./deployment.md).
- Render rich text and serve media: [Rich content & media](./rich-content.md).
- Add localization: [Localization & i18n](./i18n.md).
- Manage everything from the terminal: [CLI reference](./cli.md).
