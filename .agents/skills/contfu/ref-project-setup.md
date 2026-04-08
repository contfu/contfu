# Full Project Setup

This is the end-to-end flow. The SKILL.md bootstrap already discovered existing state — use that context to skip completed steps.

## The data flow

```
CMS (Notion, Strapi, etc.)
  → CMS Connection (OAuth or token)
    → Source collections (discovered via web UI)
      → App connection (app API key)
        → Target collections (content buckets, owned by the client)
          → Flows (source → target mapping)
            → Client SDK (query in code)
```

## Step 1 — CMS connection

If no CMS connection exists, ask which CMS the user wants. For Notion → load `ref-connect-source.md`.

For token-based providers:

```bash
contfu connections types                    # show available providers
contfu connections create --name "<label>" --type <provider> --token <token>
```

If a CMS connection already exists, say so and move to step 2.

## Step 2 — App connection + SDK install

Create the app connection **before** collections — you need its ID to associate collections with it.

Always run `contfu setup` for this step — it installs the SDK package AND creates the app connection in one go:

```bash
contfu setup --non-interactive --package @contfu/client --app-name <project-name> --env-file .env
```

- `--package @contfu/client` — for apps that query a remote Contfu server (most cases)
- `--package @contfu/contfu` — only for apps that embed a local Contfu database
- `--env-file .env` — writes `CONTFU_KEY=...` to the env file (appends)
- `--app-name` — use a slug matching the project name

Setup skips steps already done: if the package is already installed, it moves straight to app connection setup. If an app connection already exists, skip this step and note its `id` from `contfu connections list -f json`.

## Step 3 — Collections

Collections must be associated with the client via `--connection-id <client-id>`. This lets the client subscribe to them.

If collections already exist (imported from web UI), check whether they have `connectionId` set:

```bash
contfu collections list -f json
```

Collections with `"connectionId": null` are standalone — the client cannot see them. Re-create them with the client ID:

```bash
contfu collections delete <id>
contfu collections create --display-name "<name>" --connection-id <client-id>
```

To create new collections:

```bash
contfu collections create --display-name "Blog Posts" --connection-id <client-id>
```

## Step 4 — Import source collections (web UI required)

Source collections from `contfu discover` have UUID refs but no numeric IDs yet. Before creating flows, the user must import the needed databases via the web UI:

```
https://contfu.com/connections/<cms-connection-id>
```

Ask the user to import each database they want to sync. Once imported, numeric source collection IDs appear in:

```bash
contfu connections get <cms-connection-id>
```

Each imported source collection in the response has an `id` field — use that as `--source-id`.

## Step 5 — Flows

Check which collections already have flows. Suggest wiring up any that don't:

> "Authors" doesn't have a flow yet. Want me to connect it to your Notion workspace?

To create a flow, you need the **numeric** source collection ID (from the imported source collections in `contfu connections get`) and the target collection ID.

```bash
contfu flows create --source-id <numeric-src-id> --target-id <tgt>
```

## Step 5 — SDK setup

Load `ref-client-sdk.md` for package installation, type generation, typed client setup, and replacing mock content with live Contfu queries.
