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
contfu status                    # default overview
contfu status -a                 # compact, agent-oriented output
contfu status -a --full          # all resource fields
contfu status -j                 # JSON output when required by another tool
```

`agent` is TOON-encoded and compact by default; add `--full` for all fields. The default
output remains intended for interactive terminal use.

## Workspaces

```bash
contfu workspaces list [-f default|agent|json] [--full]  # or -a/-j
contfu workspaces switch <workspace-id-or-name>
```

Workspace refs resolve by ID first, then exact `name` or `displayName`. Prefer IDs in agent-run commands.

## Setup (agent-oriented)

```bash
contfu setup                     # interactive wizard
contfu setup --non-interactive --package @contfu/client --app-name my-app --env-file .env
```

Flags:

- `--package <name>` — which package to install: `@contfu/contfu` or `@contfu/client`
- `--app-name <name>` — name for the new app integration
- `--env-file <path>` — write `CONTFU_KEY=...` to this file (appends)
- `--non-interactive` — skip all prompts; fail if required info is missing

Skips steps already done: if the package is already installed, setup moves straight to app integration setup.

## Discover source collections

```bash
contfu integrations scan <integration-id-or-name> -a [--full]  # compact available source collections
```

Returns compact `{ ref, displayName, scope?, alreadyAdded }` rows by default. Add `--full` to include service metadata such as schemas, locales, and options.

## Import source collections

```bash
contfu integrations add <integration-id-or-name> --refs <comma-separated> [-a] [--full]
contfu integrations add <integration-id-or-name> --all [-a] [--full]
contfu integrations add <integration-id-or-name> --select [-a] [--full]  # interactive picker
```

## Components

```bash
contfu integrations components <integration-id-or-name> -a [--full]
```

Returns compact component rows by default; add `--full` for the complete component schema.

## Regenerate app key

```bash
contfu integrations regenerate-key <integration-id-or-name>   # regenerate the API key for an app integration
```

## Resource CRUD

Resources: `integrations`, `collections`, `flows`

```bash
contfu <resource> list [-f default|agent|json] [--full]  # or -a/-j
contfu <resource> get <id-or-name>
contfu <resource> create [flags]
contfu <resource> update <id-or-name> [flags]    # also accepts "set"
contfu <resource> delete <id-or-name>
```

### Integration flags

```
-n, --name <name>        Label (required for create)
-t, --type <service>     Service: notion, contentful, strapi, app (default: notion)
    --token <token>      API token (for token-based integrations)
-d, --data <json>        Raw JSON body
```

### Collection flags

```
    --display-name <name>    Display name (required for create)
-n, --name <name>            camelCase name (auto-derived if omitted)
    --integration-id <id-or-name>
                            Associate with a app integration (prefer app integration ID)
    --[no-]include-ref       Include source reference IDs
-d, --data <json>            Raw JSON body
```

### Flow flags

```
    --source-id <id-or-name>
                            Source collection ID or name (required for create; prefer ID)
    --target-id <id-or-name>
                            Target collection ID or name (required for create; prefer ID)
    --[no-]include-ref       Include source reference data
-d, --data <json>            Raw JSON body
```

## Type generation

```bash
contfu integrations types              # list valid service types
contfu integrations types <integration-id-or-name>         # TypeScript types for an integration's collections
contfu collections types <collection-id-or-name>         # TypeScript types for a collection
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
