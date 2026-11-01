# Full Project Setup

This is the end-to-end flow. The SKILL.md bootstrap already integrations scaned existing state — use that context to skip completed steps.

## The data flow

```
CMS (Notion, Strapi, etc.)
  → CMS Integration (OAuth or token)
    → Source collections (integrations scaned via web UI)
      → App integration (app API key)
        → Target collections (content buckets, owned by the client)
          → Flows (source → target mapping)
            → Client SDK (query in code)
```

## Step 1 — CMS integration

If no CMS integration exists, ask which CMS the user wants. For Notion → load `ref-connect-source.md`.

For token-based services:

```bash
contfu integrations types                    # show available services
contfu integrations create --name "<label>" --type <service> --token <token>
```

If a CMS integration already exists, say so and move to step 2.

## Step 2 — App integration + SDK install

Create the app integration **before** collections — you need its ID to associate collections with it.

**Ask the user which runtime they want before running this.** `--package` picks a deployment architecture, so there is no default to fall back on:

| Package          | What the app does                                                                   | What the user must operate                |
| ---------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `@contfu/contfu` | Embeds the runtime; `connect()` syncs into a local SQLite store, queried in-process | Nothing extra                             |
| `@contfu/client` | Sends HTTP queries to a Contfu Server                                               | A deployed `@contfu/server`, plus its URL |

`contfu.com` is the control plane and does **not** serve the query API — app integrations have `url: null` by design. Choosing `@contfu/client` when no `@contfu/server` is running produces an app that cannot read anything, and the symptom is a late, confusing 404 that returns the marketing SPA's HTML. When the user has no Server, choose `@contfu/contfu`.

Then run `contfu setup` — it installs the package AND creates the app integration in one go:

```bash
contfu setup --non-interactive --package <chosen-package> --app-name <project-name> --env-file .env
```

- `--env-file .env` — writes `CONTFU_KEY=...` to the env file (appends)
- `--app-name` — use a slug matching the project name

In a monorepo, point `--env-file` at the consuming app (e.g. `packages/app/.env`) and verify afterwards where the dependency landed: `contfu setup` may add it to the root `package.json` rather than the workspace that imports it. Move it if so.

Setup skips steps already done: if the package is already installed, it moves straight to app integration setup. If an app integration already exists, skip this step and note its `id` from `contfu integrations list -a`.

## Step 3 — Collections

Collections must be associated with the client via `--integration-id <client-id>`. This lets the client subscribe to them.

If collections already exist (imported from web UI), check whether they have `integrationId` set:

```bash
contfu collections list -a
```

Collections with `"integrationId": null` are standalone — the client cannot see them. Re-create them with the client ID:

```bash
contfu collections delete <id>
contfu collections create --display-name "<name>" --integration-id <client-id>
```

To create new collections:

```bash
contfu collections create --display-name "Blog Posts" --integration-id <client-id>
```

## Step 4 — Add source collections

Scan available source collections and add them via the CLI:

```bash
contfu integrations scan <cms-integration-id> -a       # list available source collections
contfu integrations add <cms-integration-id> --all     # import all, or --refs <refs> for specific ones
```

After import, source collection IDs are available:

```bash
contfu collections list -a
```

Each imported source collection has an `id` field — use that as `--source-id`.

## Step 5 — Flows

Check which collections already have flows. Suggest wiring up any that don't:

> "Authors" doesn't have a flow yet. Want me to connect it to your Notion workspace?

To create a flow, you need the source collection ID (from `contfu collections list -a`) and the target collection ID.

```bash
contfu flows create --source-id <source-id> --target-id <target-id>
```

## Step 5 — SDK setup

Load `ref-client-sdk.md` for package installation, type generation, typed client setup, and replacing mock content with live Contfu queries.
