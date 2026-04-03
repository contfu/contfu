# Connecting to Notion

## Overview

Contfu connects to Notion via OAuth. The user authorizes their Notion workspace through the Contfu web UI, which handles the OAuth handshake and stores the access token securely.

## Steps

### 1. Authenticate with Contfu

Ensure the user is logged in:

```bash
contfu login
```

### 2. Create the Notion connection via the web UI

The Notion OAuth flow requires a browser redirect and cannot be done entirely from the CLI. Direct the user to the Contfu web app:

1. Open the Contfu dashboard (e.g., `https://app.contfu.com` or their self-hosted instance)
2. Go to **Connections** > **New Connection**
3. Select **Notion** as the provider
4. Click **Connect Notion** — this opens the Notion OAuth consent screen
5. The user selects which pages/databases to share with Contfu
6. After authorization, the connection appears in the dashboard

### 3. Verify the connection via CLI

```bash
contfu connections list
```

The new Notion connection should appear with its ID and name (auto-resolved from the Notion workspace name).

### 4. Discover collections

After the connection is created, Contfu can scan the authorized Notion pages to discover available databases:

```bash
contfu connections get <connection-id>
```

This shows the connection details and its source collections (the Notion databases the user shared access to).

### 5. Next steps

Once connected, the user typically wants to:
- **Create collections and flows** to sync Notion data → load `ref-collections-flows.md`
- **Set up a client** to query the synced content → load `ref-client-sdk.md`

## Troubleshooting

| Problem | Fix |
|---------|-----|
| OAuth consent screen doesn't show expected pages | The Notion integration needs access granted — in Notion, open the page > "..." menu > "Connections" > add the Contfu integration |
| Connection shows but no source collections | The scan may still be running. Wait a moment and re-check with `contfu connections get <id>` |
| "Not authenticated" error | Run `contfu login` or set `CONTFU_API_KEY` |
