# Integrations

An **integration** is an authenticated link between a workspace and either a content
**Provider** or your **Application**. Every integration carries one or both roles:

- **Ingress** — it can provide items _into_ Contfu (a CMS source).
- **Egress** — it can receive items _from_ Contfu (your application).

This page covers connecting source integrations and registering application integrations.
For what happens to the content once it is flowing, see
[Collections](./collections.md) and [Flows](./flows.md).

## Source integrations (Ingress)

A source integration connects a CMS Provider so its content can be pulled into Contfu.

### Provider types

List the providers your workspace can connect:

```bash
contfu integrations types
```

Typical types: `notion`, `strapi`, `contentful`, `web`. Providers fall into two
authentication styles:

- **OAuth providers** (e.g. Notion) — authorization happens in a browser consent screen.
- **Token providers** (e.g. Strapi, Contentful, Web) — you paste an API token.

### Connect via the web UI

Integrations are created in the Cloud Service web UI. The quickest route is a deep link
with the type pre-selected:

```
https://contfu.com/integrations/new?type=<type>
```

- `?type=notion` — starts the OAuth flow automatically; you authorize in the consent
  screen, then grant Contfu access to the specific pages/databases.
- `?type=strapi` (or `contentful`, `web`) — opens a pre-filled form; enter a name and API
  token.
- `?type=app` — jumps to the application integration tab (see below).

### Connect a token provider from the CLI

Token-based providers can be created without the UI:

```bash
contfu integrations create --name "Marketing CMS" --type strapi --token <token>
```

Verify and capture the ID:

```bash
contfu integrations list -f json
```

### Scopes

A **Scope** is a provider-side namespace that limits which collections an ingress
integration exposes. Provider-native concepts map onto scopes:

| Provider   | Scope is…      |
| ---------- | -------------- |
| Sanity     | a dataset      |
| Contentful | an environment |

When no scopes are configured, the integration exposes the provider's default scopes, or
all accessible scopes when the provider can enumerate them. Scopes also disambiguate two
provider collections that share a native name within one integration.

> In Contfu terminology and persisted state, always speak of **scopes** — the
> provider-specific words (dataset, environment) are only useful for finding the setting
> in the provider's own UI.

### Drafts

Some providers expose unpublished content. Draft-capable integrations should make draft
synchronization an explicit setting:

- **Enabled** — synchronized items expose [`$draft`](./system-properties.md), and pulls
  include unpublished records.
- **Disabled** — pulls request published-only records and draft-only pushes are ignored.

### Discover and import source collections

After the integration exists, scan what it exposes:

```bash
contfu integrations scan <integration-id>
```

This returns the available source collections — Notion databases, Strapi content types,
etc. — each with `ref`, `displayName`, and `alreadyAdded`. Import the ones you want so
they get stable Contfu IDs:

```bash
contfu integrations add <integration-id> --refs <comma-separated-refs>
contfu integrations add <integration-id> --all       # import everything
contfu integrations add <integration-id> --select    # interactive picker
```

Imported source collections then appear in `contfu collections list -f json` with numeric
`id`s — use those as `--source-id` when [wiring flows](./flows.md).

### Troubleshooting

| Problem                                          | Fix                                                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| OAuth consent screen doesn't show expected pages | The provider needs access granted. In Notion: open the page → `…` menu → Integrations → add Contfu. |
| Integration created but no source collections    | The scan may still be running. Wait, then re-run `contfu integrations scan <id>`.                   |
| "Not authenticated"                              | Run `contfu login`, or set `CONTFU_API_KEY`.                                                        |

## Application integrations (Egress)

An **application integration** represents your Application in the Cloud Service. It is the
Cloud-side counterpart of the **Connector** your Local Runtime uses, and it issues the API
key your app authenticates with.

### Create one

The `setup` command creates the app integration and installs the SDK together:

```bash
contfu setup --non-interactive \
  --package @contfu/client \
  --app-name my-app \
  --env-file .env
```

- `--package` — `@contfu/client` (query a remote Server) or `@contfu/contfu` (embed the
  Local Runtime).
- `--app-name` — a slug for the app integration.
- `--env-file` — appends `CONTFU_KEY=<app-key>` to the given file.

If you only need the integration (no SDK install), create it directly:

```bash
contfu integrations create --name my-app --type app
```

Collections become visible to an app by being associated with its app integration
(`--integration-id <app-integration-id>` when creating them). See
[Collections](./collections.md#associating-collections-with-an-app).

### Rotate the API key

```bash
contfu integrations regenerate-key <app-integration-id>
```

The previous key stops working immediately, so update your `CONTFU_KEY` everywhere it is
configured.

## Lifecycle states

Any integration can be:

- **Paused** — synchronization intentionally stopped by a user or operator.
- **Quota Blocked** — synchronization stopped because the Organization exceeded an
  enforced [plan](./concepts.md#account--commercial) quota.

Neither state automatically raises an [incident](./flows.md#incidents); they are expected,
user-visible conditions.
