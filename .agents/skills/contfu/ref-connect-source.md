# Connecting a CMS Source

## Overview

Contfu connects to CMS providers via the web UI. OAuth providers (e.g. Notion) handle authorization automatically; token-based providers (Strapi, Contentful, Web) require pasting an API token.

## Steps

### 1. Authenticate with Contfu

Ensure the user is logged in:

```bash
contfu login
```

### 2. Identify the connection type

List available connection types:

```bash
contfu connections types
```

This outputs type names like `notion`, `strapi`, `contentful`, `web`, `client`. Use the matching name in the deep link.

### 3. Create the connection via deep link

Direct the user to the new-connection page with the type pre-selected:

```
https://contfu.com/connections/new?type=<type-name>
```

For example: `https://contfu.com/connections/new?type=notion`

- **OAuth providers** (e.g. `notion`): the OAuth flow starts automatically — the user just authorizes in the consent screen.
- **Token-based providers** (e.g. `strapi`, `contentful`, `web`): the form is pre-filled with the correct provider; the user enters a name and API token.
- **App connections**: use `?type=app` to jump to the app tab.

### 4. Verify the connection via CLI

```bash
contfu connections list
```

The new connection should appear with its ID and name.

### 5. Discover collections

After the connection is created, connections scan available source collections:

```bash
contfu connections scan <connection-id>
```

This shows the available source collections (Notion databases, Strapi content types, etc.) with `ref`, `displayName`, and `alreadyAdded` fields.

### 6. Next steps

Once connected, the user typically wants to:
- **Create collections and flows** to sync data → load `ref-collections-flows.md`
- **Set up a client** to query the synced content → load `ref-client-sdk.md`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| OAuth consent screen doesn't show expected pages | The CMS integration needs access granted — e.g. in Notion, open the page > "..." menu > "Connections" > add the Contfu integration |
| Connection shows but no source collections | The scan may still be running. Wait a moment and re-check with `contfu connections scan <id>` |
| "Not authenticated" error | Run `contfu login` or set `CONTFU_API_KEY` |
