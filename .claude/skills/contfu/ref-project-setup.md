# Full Project Setup

This is the end-to-end flow. The SKILL.md bootstrap already discovered existing state — use that context to skip completed steps.

## The data flow

```
CMS (Notion, Strapi, etc.)
  → CMS Connection (OAuth or token)
    → Source collections (discovered via web UI)
      → Flows (source → target mapping)
        → Target collections (content buckets)
          → Client connection (app API key)
            → Client SDK (query in code)
```

## Step 1 — CMS connection

If no CMS connection exists, ask which CMS the user wants. For Notion → load `ref-notion-connect.md`.

For token-based providers:

```bash
contfu connections types                    # show available providers
contfu connections create --name "<label>" --type <provider> --token <token>
```

If a CMS connection already exists, say so and move to step 2.

## Step 2 — Collections

If collections already exist (from web UI import), list them:

```bash
contfu collections list
```

Present them and ask which ones the user wants to use, or if they need more.

If no collections exist and the user needs to discover/import from their CMS:
- Direct them to the web UI (Connections → click connection → discover databases)
- Wait for them to confirm they've imported, then re-run `contfu collections list -f json`

To create collections manually:

```bash
contfu collections create --display-name "Blog Posts"
```

## Step 3 — Flows

Check which collections already have flows (from the bootstrap data). Suggest wiring up any that don't:

> "Authors" doesn't have a flow yet. Want me to connect it to your Notion workspace?

To create a flow, you need the source collection ID and target collection ID. Source collections come from the CMS connection — check with `contfu connections get <id>`.

```bash
contfu flows create --source-id <src> --target-id <tgt>
```

## Step 4 — Client connection

If no CLIENT connection (type 0) exists:

```bash
contfu connections create --name "my-app" --type client
```

**The API key is only shown once.** Immediately help the user save it:

```bash
echo "CONTFU_URL=https://app.contfu.com" >> .env
echo "CONTFU_API_KEY=<key>" >> .env
```

Make sure `.env` is in `.gitignore`.

If a CLIENT connection exists, remind the user of its name and that the API key was shown at creation time.

## Step 5 — SDK setup

Load `ref-client-sdk.md` for package installation, type generation, and code examples.
