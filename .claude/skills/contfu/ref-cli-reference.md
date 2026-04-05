# CLI Reference

## Running the CLI

```bash
contfu <command> [args...]       # if installed globally
bunx @contfu/cli <command>       # via bunx
npx @contfu/cli <command>        # via npx
```

## Authentication

```bash
contfu login                     # browser OAuth flow
contfu login --no-browser        # code-based flow (for headless/SSH)
contfu logout                    # clear stored credentials
```

Credentials stored in `~/.config/contfu/config.json`. Override with `CONTFU_API_KEY` env var.

## Status

```bash
contfu status                    # table overview
contfu status -f json            # JSON output
```

## Setup (agent-oriented)

```bash
contfu setup                     # interactive wizard
contfu setup --non-interactive --package @contfu/client --client-name my-app --env-file .env
```

Flags:

- `--package <name>` — which package to install: `@contfu/contfu` or `@contfu/client`
- `--client-name <name>` — name for the new client connection
- `--env-file <path>` — write `CONTFU_KEY=...` to this file (appends)
- `--non-interactive` — skip all prompts; fail if required info is missing

Skips steps already done: if the package is already installed, setup moves straight to client connection setup.

## Discover source collections

```bash
contfu discover <connection-id>  # JSON: available source collections from a CMS connection
```

Returns `[{ ref, displayName, alreadyImported, icon? }]` — the databases/content types available in that connection.

## Resource CRUD

Resources: `connections`, `collections`, `flows`, `consumers`

```bash
contfu <resource> list [-f json]
contfu <resource> get <id>
contfu <resource> create [flags]
contfu <resource> update <id> [flags]    # also accepts "set"
contfu <resource> delete <id>
```

### Connection flags

```
-n, --name <name>        Label (required for create)
-t, --type <provider>    Provider: notion, contentful, strapi, client (default: notion)
    --token <token>      API token (for token-based connections)
-d, --data <json>        Raw JSON body
```

### Collection flags

```
    --display-name <name>    Display name (required for create)
-n, --name <slug>            URL-safe slug (auto-derived if omitted)
    --connection-id <id>     Associate with a client connection (use client connection ID)
    --[no-]include-ref       Include source reference IDs
-d, --data <json>            Raw JSON body
```

### Flow flags

```
    --source-id <id>         Source collection ID (required for create)
    --target-id <id>         Target collection ID (required for create)
    --[no-]include-ref       Include source reference data
-d, --data <json>            Raw JSON body
```

### Consumer flags

```
-n, --name <name>            Label (required for create)
-d, --data <json>            Raw JSON body
```

## Type generation

```bash
contfu connections types              # list valid provider types
contfu connections types <id>         # TypeScript types for a connection's collections
contfu collections types <id>         # TypeScript types for a collection
contfu consumers types <id>           # TypeScript types for a consumer's collections
```

## Item queries

Requires a running client HTTP server (`-u` flag):

```bash
contfu items query -u <url> [options]
contfu items count -u <url> [options]
```

Query options:

```
-u, --client-url <url>      Base URL (required)
    --collection <name>     Filter by collection
    --filter <expr>         Filter expression
    --sort <fields>         Sort (comma-separated, prefix - for desc)
    --limit <n>             Max results (default 20)
    --offset <n>            Skip N results
    --include <fields>      Comma-separated includes
    --fields <fields>       Comma-separated field selection
    --flat                  Flatten nested properties
```
