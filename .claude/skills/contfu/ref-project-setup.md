# Full Project Setup

This is the end-to-end flow. The SKILL.md bootstrap already discovered existing state — use that context to skip completed steps.

## The data flow

```
CMS (Notion, Strapi, etc.)
  → CMS Connection (OAuth or token)
    → Source collections (discovered via web UI)
      → Client connection (app API key)
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

## Step 2 — Client connection

Create the client connection **before** collections — you need its ID to associate collections with it.

If no CLIENT connection (type 0) exists, run setup:

```bash
contfu setup
```

Setup will install the SDK package, create the client connection, and offer to write `CONTFU_KEY` to `.env`.

For non-interactive / agent-driven setup:

```bash
contfu setup --non-interactive --package @contfu/client --client-name my-app --env-file .env
```

If a CLIENT connection already exists, note its `id` from `contfu connections list -f json` — you'll need it in step 3.

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

## Step 4 — Flows

Check which collections already have flows. Suggest wiring up any that don't:

> "Authors" doesn't have a flow yet. Want me to connect it to your Notion workspace?

To create a flow, you need the source collection ID and target collection ID. Source collections come from the CMS connection — check with `contfu connections get <id>`.

```bash
contfu flows create --source-id <src> --target-id <tgt>
```

## Step 5 — SDK setup

Load `ref-client-sdk.md` for package installation, type generation, and code examples.
