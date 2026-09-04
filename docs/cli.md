# CLI Reference

The **Contfu CLI** (`@contfu/cli`) manages Contfu resources from the terminal —
integrations, collections, flows, and type generation — and queries user-hosted Servers
for local application content.

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
`CONTFU_API_KEY` environment variable (handy in CI). Contfu commands target
`https://contfu.com` implicitly.

> `CONTFU_API_KEY` authenticates the CLI as a user. It is **not** the same as `CONTFU_KEY`,
> which is the app integration key the [Contfu runtime](./deployment.md) uses to sync.

## Status

```bash
contfu status                 # default overview
contfu status -a              # compact TOON-encoded output for agents
contfu status -a --full       # all resource fields
contfu status -j             # JSON: authenticated, integrations, collections, flows
```

Commands that support structured output accept `-f default|agent|json`; use `-a` or `-j` as shortcuts for agent and JSON output. `agent` is
TOON-encoded and uses a compact shape by default; add `--full` when all fields are needed. The default format is selected by omitting the format flag.

## Workspaces

```bash
contfu workspaces list [-f default|agent|json] [--full]
contfu workspaces get <id-or-name> [-f default|agent|json] [--full]
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
contfu orgs list [-f default|agent|json] [--full]
contfu orgs get <id-or-name> [-f default|agent|json] [--full]
contfu orgs usage <id-or-name> [-f default|agent|json]
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
membership and invite commands support `--dry-run`. Detail commands accept `-f default|agent|json`,
`-a`, `-j`, and `--full`; agent output is compact unless `--full` is supplied.

`orgs usage` resolves an organization by ID first, then exact name or display name. It reports
`integrations`, `collections`, `flows`, `items`, and period-based `itemChanges` from the service's
authoritative quota state. Structured output has this stable shape (the organization ID is the
encoded public ID):

```json
{
  "organization": { "id": "org_1", "name": "acme", "displayName": "Acme" },
  "metrics": {
    "integrations": { "used": 2, "limit": 10 },
    "collections": { "used": 8, "limit": null },
    "flows": { "used": 3, "limit": 10 },
    "items": { "used": 120, "limit": 1000 },
    "itemChanges": { "used": 17, "limit": 100 }
  }
}
```

JSON prints this object as formatted JSON; `--format agent` prints the same fields and numeric
values as compact TOON. A `null` limit consistently means unlimited or unavailable. The default
format renders each metric as a deterministic 20-character ASCII bar followed by `used / limit`,
using `unlimited` for a null limit:

```text
Organization: Acme (org_1)
Integrations   [####----------------] 2 / 10
Collections    [--------------------] 8 / unlimited
Flows          [######--------------] 3 / 10
Items          [##------------------] 120 / 1000
Item changes   [###-----------------] 17 / 100
```

## Setup wizard

Installs a Contfu package and creates an app integration in one step:

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
contfu integrations list [-f default|agent|json] [--full]
contfu integrations get <id-or-name> [-f default|agent|json] [--full]
contfu integrations create -n "<label>" -t <service> [--token <token>]
contfu integrations create -n "Contentful" -t contentful --url <space-id> --scope <environment> [--contentful-api-mode delivery|preview]
contfu integrations create -n "WordPress" -t wordpress --url <site-url> [--username <user> --application-password <password>]
contfu integrations update <id-or-name> [flags]
contfu integrations delete <id-or-name>

contfu integrations types                       # list valid Service types
contfu integrations scan <id-or-name> [--format default|agent|json] [--full]
contfu integrations scan <id-or-name> --select  # discover and choose collections interactively
contfu integrations add  <id-or-name> [--refs <a,b> | --all | --select] \
  [--format default|agent|json] [--full]
contfu integrations regenerate-key <id-or-name> # rotate an app integration's API key
```

Create flags: `-n/--name` (required), `-t/--type` (one of the Service IDs from
`contfu integrations types`; default `notion`), `--token`, `--username` plus
`--application-password` for WordPress application-password auth, `--url <url-or-id>` for
Service base URLs or service-specific identifiers such as a Contentful space ID,
`--project-id` for Sanity, `--scope`/`--scopes`, `--webhook-secret`, webhook target
`--webhook-header`, `--webhook-max-attempts`, and `--webhook-delivery-window`, Contentful
`--contentful-api-mode delivery|preview`, `--contentful-delivery-token`,
`--contentful-preview-token`, and `--contentful-management-token`, `--include-drafts` /
`--no-include-drafts` for Services with draft modes, `--generate-key`, and
`-d, --data <json>`. For Sanity, `--project-id` is required and `--scope`/`--scopes`
restrict exposed datasets. For Contentful, `--url` is the space ID, `--scope`/`--scopes` restrict
exposed environments, Delivery API mode is the default, and Preview API mode requires a preview
token on create. Preview full pulls are best-effort: deleted entries cannot be detected and
Preview push is unavailable; use Delivery API mode for authoritative deletion reconciliation. For
Web sources, `--url` is the base URL and `--token` is sent as a Bearer token. For webhook target integrations, `--url` is the HTTPS endpoint template
and may use `{collection}`, `{collectionName}`, or `{itemId}`. Use `--webhook-header
Name=Value[,Name=Value]` for static outbound headers; Contfu-managed content type, version,
timestamp, and signature headers take precedence. Unknown `--type` values fail before
any request is sent. Update flags include `-n/--name`, `--token`, WordPress credential flags,
Contentful API-mode/token flags, `--scope`/`--scopes`, `--webhook-secret`, webhook target flags,
draft-mode flags, localization flags, and `-d, --data <json>`.

Localization flags: `--i18n-locales <en,de>`, `--i18n-active-locales inherit|custom:<locales>`,
`--i18n-locale-map <raw=locale,...>`, and `--reset-i18n`. Locale map values must be active
locales. See [Localization and i18n](./i18n.md).

`scan` returns `[{ ref, displayName, scope?, alreadyAdded, icon? }]`. Use `-a`
for compact TOON output, and add `--full` for all fields. `scan --select` and `add --select`
open the same interactive picker; `add --refs` and `add --all` are better for scripts. `add`
imports source collections so they get numeric IDs usable as `--source-id`
in flows. See [Integrations](./integrations.md).

## Components

```bash
contfu integrations components <integration-id-or-name> [-f default|agent|json] [--full] # agent is compact by default
contfu components get <component-id> [-f default|agent|json] [--full]
contfu components create <integration-id-or-name> \
  --name hero \
  --display-name "Hero" \
  --service-ref hero
contfu components update <component-id> [flags]
contfu components delete <component-id>
```

Components are scoped to a Source Role integration. List discovered or configured components
from that integration with `contfu integrations components`; inspect a component with
`contfu components get`. Structured detail output accepts the same format flags and compact agent
output is used unless `--full` is supplied.

| Flag                    | Description                                                                  |
| ----------------------- | ---------------------------------------------------------------------------- |
| `-n, --name <name>`     | Runtime component name delivered as the application block discriminator.     |
| `--display-name <name>` | Human-readable label.                                                        |
| `--service-ref <ref>`   | Service component identifier; required for manual create.                    |
| `-d, --data <json>`     | Raw JSON body for fields such as `propsSchema`, `mapping`, or status fields. |
| `--dry-run`             | Preview create/update/delete without mutating state.                         |

Renaming `name` is a breaking application contract change. See
[Collections → Components](./collections.md#components).

## Collections

```bash
contfu collections list [-f default|agent|json] [--full]
contfu collections get <id-or-name> [-f default|agent|json] [--full]
contfu collections create --display-name "<name>" [flags]
contfu collections update <id-or-name> [flags]
contfu collections delete <id-or-name>
contfu collections sync-now <id-or-name> [--wait] [--dry-run]
contfu collections full-refresh <id-or-name> [--wait] [--dry-run]
contfu collections full-resync <id-or-name> [--refresh-source-first] [--wait] [--dry-run]
contfu collections pause <id-or-name> [--dry-run]
contfu collections resume <id-or-name> [--dry-run]
contfu collections operations <id-or-name> [-f json]
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

`sync-now` starts an ordinary source pull and `full-refresh` rebuilds source state before pulling. Add
`--wait` to either command to poll its source operation until `COMPLETED`, `FAILED`, or `BLOCKED`;
failed or blocked operations exit non-zero. `operations` lists the collection's durable operation
history and is useful for scripts (for example, `contfu collections operations <id> -f json`).
`full-resync` is a target repair operation; `--refresh-source-first` performs a Full refresh of
incoming sources before rebuilding the target. `--dry-run` previews all mutations without calling
mutation endpoints.

See [Collections](./collections.md).

## Flows

```bash
contfu flows list [-f default|agent|json] [--full]
contfu flows get <id-or-name> [-f default|agent|json] [--full]
contfu flows create --source-id <id> --target-id <id> [flags]
contfu flows update <id-or-name> [flags]
contfu flows delete <id-or-name>
```

| Flag                       | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `--source-id <id-or-name>` | Source collection (required for create; prefer the ID).                       |
| `--target-id <id-or-name>` | Target collection (required for create; prefer the ID).                       |
| `-d, --data <json>`        | Raw JSON body for mappings/filters; may be combined with source/target flags. |

Flow detail output accepts the same format flags and compact agent output is used unless `--full`
is supplied. Enum values in structured output use readable labels; unknown numeric values are
preserved as `unknown(<value>)`.

See [Flows](./flows.md).

## Type generation

```bash
contfu integrations types                       # list valid Service types
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

Structured-output commands accept `-a` (or `-f agent`) for compact TOON-encoded agent output or
`-j` / `-f json` for machine-readable JSON. The `-a` and `-j` shortcuts select agent and
JSON output; add `--full` to agent output to include all fields. The default format is selected
by omitting the format flag and remains intended for interactive terminal use.
