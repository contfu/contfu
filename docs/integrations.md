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

Typical types: `notion`, `strapi`, `contentful`, `wordpress`, `sanity`, `web`. Providers fall into two
authentication styles:

- **OAuth providers** (e.g. Notion) — authorization happens in a browser consent screen.
- **Token providers** (e.g. Strapi, Contentful, Sanity, Web) — you paste an API token.
- **Application-password providers** (e.g. WordPress) — public content can be read anonymously, while preview/draft access uses a WordPress username and application password.

### Connect via the web UI

Integrations are created in the Cloud Service web UI. The quickest route is a deep link
with the type pre-selected:

```
https://contfu.com/integrations/new?type=<type>
```

- `?type=notion` — starts the OAuth flow automatically; you authorize in the consent
  screen, then grant Contfu access to the specific pages/databases.
- `?type=strapi` (or `contentful`, `sanity`, `web`) — opens a pre-filled form; enter a name and API
  token.
- `?type=wordpress` — enter the public site URL; add a WordPress username and application password only when you enable non-published content.
- `?type=app` — jumps to the application integration tab (see below).

### Connect a provider from the CLI

Token-based and application-password providers can be created without the UI. Use
`contfu integrations types` to list valid provider IDs; unknown `--type` values fail before any
request is sent.

```bash
contfu integrations create --name "Marketing CMS" --type strapi --url <api-url> --token <token>
contfu integrations create --name "Sanity" --type sanity --project-id <project-id> --scope <dataset> --token <token>
contfu integrations create --name "Contentful" --type contentful --url <space-id> --scope <environment> --token <delivery-token>
contfu integrations create --name "Contentful Preview" --type contentful --url <space-id> --scope <environment> --contentful-api-mode preview --contentful-preview-token <preview-token>
contfu integrations create --name "Web" --type web --url <site-url> --token <bearer-token>
contfu integrations create --name "WordPress" --type wordpress --url <site-url> --username <user> --application-password <password>
```

For Sanity, `--project-id` is required and `--scope` names the dataset to expose. For
Contentful, the `--url` value is the space ID and `--scope` names the environment to
expose (for example, `master` or `staging`). Delivery API mode is the default; use
`--contentful-api-mode preview` with `--contentful-preview-token` to create a Preview API
integration, and pass `--contentful-delivery-token` as well when you want both tokens stored.
For Web sources, `--url` is the base URL and `--token` is sent as a Bearer token; omit the
token for public pages. For WordPress, credentials are optional for published-only sync and
required for authenticated preview/draft reads. Use `--include-drafts` or `--no-include-drafts`
to change draft-mode settings for providers that support them.

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

WordPress defaults to published-only sync. When WordPress draft sync is enabled, `$draft` is
emitted for post and media collections; taxonomies and users stay on published/view reads and do
not get synthesized draft state. WordPress preview reads can see trashed post/media records with
`status: "trash"` and `$draft: true`, but the service treats those records as soft-deleted source
items: Contfu keeps tracking them so they still count toward managed source inventory and do not
produce redundant tombstones, while downstream targets receive delete delivery and should
hard-delete them. Strapi and Sanity integrations default to including drafts unless you disable that
setting. Changing draft mode or source credentials resets accepted source state for connected
collections and schedules a repair full pull so draft/published schemas and cursors do not mix.

### Deletions from polling sources

WordPress source collections use authoritative scheduled full pulls for deletion reconciliation:
Contfu compares the latest REST listing with the last successful upstream item snapshot and emits
delete sync messages for WordPress items that disappeared. Downstream consumer collections can then
remove items that were deleted in WordPress instead of waiting for a provider webhook. In WordPress
draft sync, a post/media record that moves to `trash` emits a tombstone once and remains tracked as
soft-deleted source state until WordPress stops returning it or it is restored.

### Webhook signing and provider diagnostics

For providers with signed webhooks, store the signing secret on the integration with
`--webhook-secret` or the equivalent UI field. Contfu verifies the raw webhook body before
parsing when a secret is configured. Supported source webhook schemes include Contentful's
`x-contentful-signature` plus `x-contentful-timestamp`, Sanity webhook signatures, and Strapi
`x-strapi-signature` / `x-webhook-signature` HMAC signatures. The `@contfu/strapi`
package root is a loadable Strapi plugin entry; `@contfu/strapi/strapi-server` remains
available for setups that need an explicit server entry path.

Webhook payloads remain provider-owned dirty signals. Contfu stores provider metadata such as
event names, scopes, Contentful revisions/versions, and Sanity transaction, document, dataset,
and perspective headers for diagnostics and buffering, but applications should use normalized
item properties and Contfu scopes rather than depending on provider-specific webhook metadata.
When a Contentful delete/unpublish webhook omits localized field data, Contfu deletes the base
item ref and also dirties the collection so reconciliation can remove any materialized locale
variants safely.

### Discover and import source collections

After the integration exists, scan what it exposes:

```bash
contfu integrations scan <integration-id>
```

This returns the available source collections — Notion databases, Strapi content types,
etc. — each with `ref`, `displayName`, and `alreadyAdded`. Sanity scans are conservative:
Sanity system and asset document types are omitted by default unless an explicit type allowlist
includes them. For Strapi, Contfu stores the REST route name from the content-type metadata
(for example `people` instead of a naive `persons` plural) so later pulls and pushes use the
provider's real route. Import the ones you want so they get stable Contfu IDs:

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

### Webhook target integrations

Webhook integrations are egress-only targets that receive item payloads over HTTPS. Create one
with an endpoint URL template and optionally a signing secret:

```bash
contfu integrations create --name "Search index webhook" --type webhook \
  --url "https://example.com/contfu/{collection}/{itemId}" \
  --webhook-secret <shared-secret>
```

Supported URL template parameters are `{collection}`, `{collectionName}`, and `{itemId}`.
Add static outbound headers with `--webhook-header "Name=Value[,Name=Value]"` and tune retry
handling with `--webhook-max-attempts` / `--webhook-delivery-window`; Contfu-managed content
type, version, timestamp, and signature headers take precedence over static headers. Contfu sends
a versioned `item.current_state` JSON body with the target collection, Contfu item id,
`changedAt`, `props`, and optional `content`. Removal deliveries use the same payload shape with
`deleted: true` and omit `props`/`content`. When a secret is configured, requests include
`contfu-webhook-timestamp` and `contfu-webhook-signature: sha256=<hmac>` over
`<timestamp>.<raw-body>`.

Create a target collection for the webhook integration, then point flows at that target
collection. Non-2xx responses and network failures retry through the target-delivery queue;
acknowledged current-state redeliveries clear earlier unacknowledged records for the same item.

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
