# @contfu/cli

Command-line tool for managing Contfu resources.

## Installation

```sh
npm install -g @contfu/cli
```

## Usage

```sh
contfu [--help] <command> [args...]
```

### Commands

```
login [--no-browser]              Authenticate with Contfu
logout                            Clear stored credentials
status                            Show resource summary
setup                             Install a Contfu package and create an app integration

workspaces list|get|create|update|budget|invite|accept|join|members|revoke|switch
orgs       list|get|create|update|invite|accept|members|promote|demote

integrations list|get|create|update|delete
collections  list|get|create|update|delete
flows        list|get|create|update|delete

integrations scan <id>             Scan source collections for an integration
integrations add <id>              Add scanned source collections to Contfu
integrations components <id>       List components for an integration
integrations regenerate-key <id>   Rotate an app integration key and write CONTFU_KEY
components create|get|update|delete
                                  Manage integration-scoped components
incidents list                     List unresolved delivery incidents
incidents dismiss <id>             Dismiss a dismissible condition
integrations types                 List valid integration types
collections types                 Generate TypeScript types for a collection
items query  --collection <id>    Query items
items count  --collection <id>    Count items
```

## Authentication

Credentials are stored locally after `contfu login`. The `CONTFU_API_KEY` environment variable can be used as an alternative to interactive login.

Contfu commands target `https://contfu.com` implicitly. Use `contfu workspaces switch <id-or-name>` to persist the default workspace for resource commands, or pass `--workspace <id-or-name>` per command. For `items` commands, pass `--client-url` or set `CONTFU_SERVER_URL` to the base URL of the user-hosted Contfu Server that holds the data. Query and count commands support `--filter`, title `--search`, `--locale`, and `--fallback`; queries also support pagination, includes, field selection, sorting, and `--flat`.

Use `contfu integrations regenerate-key <app-integration-id-or-name>` to rotate an app integration API key and write it as `CONTFU_KEY` to `.env`. Pass `--env-file <path>` to write a different env file, or `--dry-run` to preview the change.

## Incidents

Use `contfu incidents list` to inspect unresolved incident conditions in the selected workspace. Each entry includes its source and target collection, specific problem, suggested action, affected count, and age. Pass `--collection <id>` to match either endpoint, `--flow <id>` to match one flow, or `--include-resolved` for incident history. Use `-j` for stable JSON output or `-a` for agent-oriented output.

Dismissible incidents advertise a dismiss command. Run `contfu incidents dismiss <incident-id>` after fixing the delivery problem. Dismissing also removes unresolved duplicate notifications for the same flow, type, and message; incidents that auto-resolve or require a corrective action cannot be dismissed.

## Creating and updating integrations

Use `contfu integrations create --name "Marketing CMS" --type <service>` with a service ID from `contfu integrations types`. Pass `--url <url-or-id>` for services that need a base URL or service-specific identifier such as a Contentful space ID or WordPress site URL. For Sanity, pass `--project-id <project-id>` and use `--scope`/`--scopes` for datasets. For Contentful, `--scope`/`--scopes` restrict exposed environments; Delivery API mode is the default, and `--contentful-api-mode preview --contentful-preview-token <token>` creates a Preview API integration. Preview full pulls are best-effort: deleted entries cannot be detected, and Preview push is unavailable; use Delivery API mode for authoritative deletion reconciliation. For WordPress, pass `--username <user> --application-password <password>` when preview/draft access needs authenticated REST requests. Unknown service IDs fail before any request is sent; omit `--type` to use `notion`.

Use `contfu integrations update <id-or-name> --token <token>`, `--webhook-secret <secret>`, webhook target header/retry flags, WordPress credential flags, Contentful API-mode/token flags, or `--include-drafts` / `--no-include-drafts` to rotate service credentials and draft-mode settings without raw JSON.

## Scanning and adding source collections

Use `contfu integrations scan <integration-id>` to inspect source collections available from a source integration. The default output is a table; pass `-a` for compact agent-oriented output or `-j` for JSON consumers. Agent output is TOON-encoded; add `--full` to include service metadata such as schemas, locales, and options.

Use `contfu integrations add <integration-id> --refs <comma-separated-refs>` to add selected scanned collections to Contfu, or `--all` to add every scanned collection that is not already added. Pass `-a` for a compact TOON-encoded summary, or `-a --full` when all fields are needed; `-j` is also supported.

In interactive terminals, `contfu integrations scan <integration-id> --select` or `contfu integrations add <integration-id> --select` lets you pick multiple scanned collections and immediately add them.

## Components

Use `contfu integrations components <integration-id>` to list components scoped to an integration. The default output is a table; pass `-a` for compact TOON output or add `--full` for the complete component schema. Use `contfu components get <component-id>` to inspect the JSON shape.

Create or edit components with `contfu components create <integration-id> --name <name> --display-name <label> --service-ref <ref>` and `contfu components update <component-id> [--name <name>] [--display-name <label>] [-d <json>]`. Renaming `--name` changes the application block discriminator, so treat it as a breaking contract change.

## Localization flags

Integrations support `--i18n-locales <en,de>`, `--i18n-active-locales inherit|custom:<locales>`, `--i18n-locale-map <raw=locale,...>`, and `--reset-i18n`.

Collections support `--i18n-locale-field <field>`, `--i18n-locale-map <raw=locale,...>`, `--i18n-keep-raw-field`, `--i18n-drop-raw-field`, `--i18n-grouping-key <field>`, and `--reset-i18n`.

Locale map values must be active locales.
