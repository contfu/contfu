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
`CONTFU_API_KEY` environment variable (handy in CI). Cloud Service commands target
`https://contfu.com` implicitly.

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
contfu workspaces get <id-or-name>
contfu workspaces create --display-name "Marketing" [--name marketing] [--organization <id-or-name>]
contfu workspaces update <id-or-name> [--display-name "New name"] [--name newName]
contfu workspaces budget <id-or-name> [--integrations <n>] [--collections <n>] [--flows <n>] [--items <n>] [--item-changes <n>]
contfu workspaces invite <id-or-name> --email <email>
contfu workspaces accept <token>
contfu workspaces join <id-or-name>
contfu workspaces members <id-or-name>
contfu workspaces revoke <id-or-name> <email>
contfu workspaces switch <workspace-id-or-name>
```

Refs resolve by ID first, then exact `name`/`displayName`. Prefer IDs in scripts. Budget
values are integers; use `unlimited` for no limit and `unset`, `null`, or an empty value to
clear an override. Mutating workspace membership and invite commands support `--dry-run`.

## Organizations

```bash
contfu orgs list [-f json]
contfu orgs get <id-or-name>
contfu orgs create --display-name "Acme" [--name acme]
contfu orgs update <id-or-name> [--display-name "New name"] [--name newName]
contfu orgs invite <id-or-name> --email <email> [--role member|admin]
contfu orgs accept <token>
contfu orgs members <id-or-name>
contfu orgs promote <id-or-name> <email>
contfu orgs demote <id-or-name> <email>
```

`organizations` is accepted as a long alias for `orgs`. Organization roles accepted by the
CLI are `member` and `admin`; owner assignment is managed by the service. Mutating organization
membership and invite commands support `--dry-run`.

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
contfu integrations create -n "Contentful" -t contentful --url <space-id> --scope <environment> [--contentful-api-mode delivery|preview]
contfu integrations create -n "WordPress" -t wordpress --url <site-url> [--username <user> --application-password <password>]
contfu integrations update <id-or-name> [flags]
contfu integrations delete <id-or-name>

contfu integrations types                       # list valid provider types
contfu integrations scan <id-or-name>           # discover source collections
contfu integrations scan <id-or-name> --select  # discover and choose collections interactively
contfu integrations add  <id-or-name> --refs <a,b> | --all | --select
contfu integrations regenerate-key <id-or-name> # rotate an app integration's API key
```

Create flags: `-n/--name` (required), `-t/--type` (one of the provider IDs from
`contfu integrations types`; default `notion`), `--token`, `--username` plus
`--application-password` for WordPress application-password auth, `--url <url-or-id>` for
provider base URLs or provider-specific identifiers such as a Contentful space ID,
`--project-id` for Sanity, `--scope`/`--scopes`, `--webhook-secret`, webhook target
`--webhook-header`, `--webhook-max-attempts`, and `--webhook-delivery-window`, Contentful
`--contentful-api-mode delivery|preview`, `--contentful-delivery-token`,
`--contentful-preview-token`, and `--contentful-management-token`, `--include-drafts` /
`--no-include-drafts` for providers with draft modes, `--generate-key`, and
`-d/--data <json>`. For Sanity, `--project-id` is required and `--scope`/`--scopes`
restrict exposed datasets. For Contentful, `--url` is the space ID, `--scope`/`--scopes` restrict
exposed environments, Delivery API mode is the default, and Preview API mode requires a preview
token on create. For Web sources, `--url` is the base URL and `--token` is sent as a
Bearer token. For webhook target integrations, `--url` is the HTTPS endpoint template
and may use `{collection}`, `{collectionName}`, or `{itemId}`. Use `--webhook-header
Name=Value[,Name=Value]` for static outbound headers; Contfu-managed content type, version,
timestamp, and signature headers take precedence. Unknown `--type` values fail before
any request is sent. Update flags include `-n/--name`, `--token`, WordPress credential flags,
Contentful API-mode/token flags, `--scope`/`--scopes`, `--webhook-secret`, webhook target flags,
draft-mode flags, localization flags, and `-d/--data <json>`.

Localization flags: `--i18n-locales <en,de>`, `--i18n-active-locales inherit|custom:<locales>`,
`--i18n-locale-map <raw=locale,...>`, and `--reset-i18n`. Locale map values must be active
locales. See [Localization and i18n](./i18n.md).

`scan` returns `[{ ref, displayName, scope?, alreadyAdded, icon? }]`. `scan --select` and
`add --select` open the same interactive picker; `add --refs` and `add --all` are better for
scripts. `add` imports source collections so they get numeric IDs usable as `--source-id`
in flows. See [Integrations](./integrations.md).

## Components

```bash
contfu integrations components <integration-id-or-name> [-f json]
contfu components get <component-id>
contfu components create <integration-id-or-name> \
  --name hero \
  --display-name "Hero" \
  --provider-ref hero
contfu components update <component-id> [flags]
contfu components delete <component-id>
```

Components are scoped to an ingress integration. List discovered or configured components
from that integration with `contfu integrations components`; inspect a component with
`contfu components get`.

| Flag                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `-n, --name <name>`     | Runtime component name delivered as the application block discriminator.     |
| `--display-name <name>` | Human-readable label.                                                        |
| `--provider-ref <ref>`  | Provider component identifier; required for manual create.                   |
| `-d, --data <json>`     | Raw JSON body for fields such as `propsSchema`, `mapping`, or status fields. |
| `--dry-run`             | Preview create/update/delete without mutating state.                         |

Renaming `name` is a breaking application contract change. See
[Collections → Components](./collections.md#components).

## Collections

```bash
contfu collections list [-f json]
contfu collections get <id-or-name>
contfu collections create --display-name "<name>" [flags]
contfu collections update <id-or-name> [flags]
contfu collections delete <id-or-name>
```

| Flag                            | Description                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `--display-name <name>`         | Required for create.                                                                               |
| `-n, --name <name>`             | camelCase slug (auto-derived if omitted).                                                          |
| `--integration-id <id-or-name>` | Associate with an app integration (prefer the ID).                                                 |
| `--content`                     | Include rich content blocks in synced items.                                                       |
| `--no-content`                  | Exclude rich content blocks from synced items.                                                     |
| `--i18n-locale-field <field>`   | Raw source property used for locale extraction.                                                    |
| `--i18n-locale-map <map>`       | Locale map entries as `raw=locale`, comma-separated.                                               |
| `--i18n-keep-raw-field`         | Keep the raw locale property in emitted items.                                                     |
| `--i18n-drop-raw-field`         | Drop the raw locale property from emitted items.                                                   |
| `--i18n-grouping-key <field>`   | Normal scalar property used to group translated variants for fallback. System fields are rejected. |
| `--reset-i18n`                  | Reset user i18n overrides and keep detected i18n.                                                  |
| `-d, --data <json>`             | Raw JSON body.                                                                                     |

See [Collections](./collections.md).

## Flows

```bash
contfu flows list [-f json]
contfu flows get <id-or-name>
contfu flows create --source-id <id> --target-id <id> [flags]
contfu flows update <id-or-name> [flags]
contfu flows delete <id-or-name>
```

| Flag                       | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `--source-id <id-or-name>` | Source collection (required for create; prefer the ID).                       |
| `--target-id <id-or-name>` | Target collection (required for create; prefer the ID).                       |
| `-d, --data <json>`        | Raw JSON body for mappings/filters; may be combined with source/target flags. |

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

# or set CONTFU_SERVER_URL instead of passing -u each time
CONTFU_SERVER_URL=http://localhost:5173 contfu items query
```

| Option                                 | Description                                            |
| -------------------------------------- | ------------------------------------------------------ |
| `-u, --client-url <url>`               | Server base URL (overrides `CONTFU_SERVER_URL`).       |
| `--collection <name>`                  | Filter by collection.                                  |
| `--filter <expr>`                      | Filter expression.                                     |
| `--search <text>`                      | Convenience title search.                              |
| `--sort <fields>`                      | Comma-separated; prefix `-` for descending.            |
| `--limit <n>`                          | Max results (default 20).                              |
| `--offset <n>`                         | Skip N results.                                        |
| `--include <fields>`                   | Comma-separated includes: `files`, `links`, `content`. |
| `--fields <fields>`                    | Comma-separated field selection.                       |
| `--locale <locale-or-false>`           | Locale override for localized collections.             |
| `--fallback <locale-or-true-or-false>` | Fallback locale override.                              |
| `--flat`                               | Flatten nested object props into dot-separated keys.   |

## Output format

Most commands accept `-f json` for machine-readable output — the right choice for scripts
and for piping into other tools.
