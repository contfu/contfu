# CLI Reference

`@contfu/cli` manages every Cloud Service resource from the terminal — integrations,
collections, flows, type generation, and ad-hoc queries.

## Install & run

```bash
npm install -g @contfu/cli
contfu <command> [args...]

# or without installing
bunx @contfu/cli <command>
npx  @contfu/cli <command>
```

## Authentication

```bash
contfu login                 # browser OAuth
contfu login --no-browser    # code flow, for headless/SSH
contfu logout                # clear stored credentials
```

Credentials are stored in `~/.config/contfu/config.json`. Override with the
`CONTFU_API_KEY` environment variable (handy in CI).

> `CONTFU_API_KEY` authenticates the CLI as a user. It is **not** the same as `CONTFU_KEY`,
> which is the app integration key the [Local Runtime](./deployment.md) uses to sync.

## Status

```bash
contfu status               # table overview
contfu status -f json       # JSON: authenticated, integrations, collections, flows
```

## Workspaces

```bash
contfu workspaces list [-f json]
contfu workspaces switch <workspace-id-or-name>
```

Refs resolve by ID first, then exact `name`/`displayName`. Prefer IDs in scripts.

## Setup wizard

Installs an SDK package and creates an app integration in one step:

```bash
contfu setup                                    # interactive
contfu setup --non-interactive \
  --package @contfu/client \
  --app-name my-app \
  --env-file .env
```

| Flag                | Description                                     |
| ------------------- | ----------------------------------------------- |
| `--package <name>`  | `@contfu/contfu` or `@contfu/client`.           |
| `--app-name <name>` | Name for the new app integration.               |
| `--env-file <path>` | Append `CONTFU_KEY=…` to this file.             |
| `--non-interactive` | Skip prompts; fail if required info is missing. |

Already-done steps are skipped: if the package is installed, setup jumps straight to the
app integration.

## Integrations

```bash
contfu integrations list [-f json]
contfu integrations get <id-or-name>
contfu integrations create -n "<label>" -t <provider> [--token <token>]
contfu integrations update <id-or-name> [flags]
contfu integrations delete <id-or-name>

contfu integrations types                       # list valid provider types
contfu integrations scan <id-or-name>           # discover source collections
contfu integrations add  <id-or-name> --refs <a,b> | --all | --select
contfu integrations regenerate-key <id-or-name> # rotate an app integration's API key
```

Create flags: `-n/--name` (required), `-t/--type` (`notion`, `contentful`, `strapi`,
`app`; default `notion`), `--token`, `-d/--data <json>`.

`scan` returns `[{ ref, displayName, alreadyAdded, icon? }]`. `add` imports source
collections so they get numeric IDs usable as `--source-id` in flows. See
[Integrations](./integrations.md).

## Collections

```bash
contfu collections list [-f json]
contfu collections get <id-or-name>
contfu collections create --display-name "<name>" [flags]
contfu collections update <id-or-name> [flags]
contfu collections delete <id-or-name>
```

| Flag                            | Description                                        |
| ------------------------------- | -------------------------------------------------- |
| `--display-name <name>`         | Required for create.                               |
| `-n, --name <name>`             | camelCase slug (auto-derived if omitted).          |
| `--integration-id <id-or-name>` | Associate with an app integration (prefer the ID). |
| `--[no-]include-ref`            | Include source reference IDs in synced items.      |
| `-d, --data <json>`             | Raw JSON body.                                     |

See [Collections](./collections.md).

## Flows

```bash
contfu flows list [-f json]
contfu flows get <id-or-name>
contfu flows create --source-id <id> --target-id <id> [flags]
contfu flows update <id-or-name> [flags]
contfu flows delete <id-or-name>
```

| Flag                       | Description                                             |
| -------------------------- | ------------------------------------------------------- |
| `--source-id <id-or-name>` | Source collection (required for create; prefer the ID). |
| `--target-id <id-or-name>` | Target collection (required for create; prefer the ID). |
| `--[no-]include-ref`       | Include source reference data.                          |
| `-d, --data <json>`        | Raw JSON body (mappings, filters, schema).              |

See [Flows](./flows.md).

## Type generation

```bash
contfu integrations types                       # list valid provider types
contfu integrations types <app-integration-id>  # types for all of an app's collections
contfu collections  types <collection-id>       # types for one collection
```

Redirect to a file in your project:

```bash
contfu integrations types <id> > src/types/contfu.ts
```

Prefer integration-wide types for app integrations. Regenerate after changing collections,
mappings, or active locales. See [Querying → Typed queries](./querying.md#typed-queries).

## Item queries

Query a running [Server](./deployment.md#self-hosted-server) from the terminal — useful for
debugging content and sync:

```bash
contfu items query -u <server-url> [options]
contfu items count -u <server-url> [options]
```

| Option                   | Description                                 |
| ------------------------ | ------------------------------------------- |
| `-u, --client-url <url>` | Server base URL (required).                 |
| `--collection <name>`    | Filter by collection.                       |
| `--filter <expr>`        | Filter expression.                          |
| `--sort <fields>`        | Comma-separated; prefix `-` for descending. |
| `--limit <n>`            | Max results (default 20).                   |
| `--offset <n>`           | Skip N results.                             |
| `--include <fields>`     | Comma-separated includes.                   |
| `--fields <fields>`      | Comma-separated field selection.            |
| `--flat`                 | Flatten nested properties.                  |

## Output format

Most commands accept `-f json` for machine-readable output — the right choice for scripts
and for piping into other tools.
