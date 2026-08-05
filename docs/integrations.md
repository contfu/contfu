# Integrations

An **integration** is an authenticated link between a workspace and a content
**Service**, **Application**, or **Webhook**. Every integration has one or both roles:

- **Source Role** — it can provide items into Contfu through **Content Provide**.
- **Target Role** — it can receive items from Contfu through **Content Receive** and its
  target delivery capability.

This page covers connecting Service Integrations and registering Application Integrations.
For what happens to the content once it is flowing, see
[Collections](./collections.md) and [Flows](./flows.md).

## Service Integrations (Source Role)

A Service Integration connects a CMS Service so its content can be pulled into Contfu.

### Service types

List the Service Integrations your workspace can connect:

```bash
contfu integrations types
```

Currently available types: `notion`, `strapi`, `contentful`, `wordpress`, `sanity`, and `web`.
Services fall into three authentication styles:

- **OAuth providers** (e.g. Notion) — authorization happens in a browser consent screen.
- **Token services** (e.g. Strapi, Contentful, Sanity, Web) — you paste an API token.
- **Application-password services** (e.g. WordPress) — public content can be read anonymously, while preview/draft access uses a WordPress username and application password.

### Connect via the web UI

Integrations are created in Contfu web UI. The quickest route is a deep link
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

### Connect a Service from the CLI

Token-based and application-password Services can be created without the UI. Use
`contfu integrations types` to list valid Service Integration IDs; unknown `--type` values fail before any
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
to change draft-mode settings for Services that support them.

Verify and capture the ID:

```bash
contfu integrations list -f json
```

### Scopes

A **Scope** is a service-side namespace that limits which collections a Source Role
integration exposes. Service-native concepts map onto scopes:

| Service    | Scope is…      |
| ---------- | -------------- |
| Sanity     | a dataset      |
| Contentful | an environment |

When no scopes are configured, the integration exposes the Service's default scopes, or
all accessible scopes when the Service can enumerate them. Scopes also disambiguate two
service collections that share a native name within one integration.

> In Contfu terminology and persisted state, always speak of **scopes** — the
> service-native words (dataset, environment) are only useful for finding the setting
> in that Service's own UI.

### Drafts

Some Services expose unpublished content. Draft-capable integrations should make draft
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
remove items that were deleted in WordPress instead of waiting for a Service webhook. In WordPress
draft sync, a post/media record that moves to `trash` emits a tombstone once and remains tracked as
soft-deleted source state until WordPress stops returning it or it is restored.

### Webhook signing and Service diagnostics

For Services with signed webhooks, store the signing secret on the integration with
`--webhook-secret` or the equivalent UI field. Contfu verifies the raw webhook body before
parsing when a secret is configured. Supported source webhook schemes include Contentful's
`x-contentful-signature` plus `x-contentful-timestamp`, Sanity webhook signatures, and Strapi
`x-strapi-signature` / `x-webhook-signature` HMAC signatures. The `@contfu/strapi`
package root is a loadable Strapi plugin entry; `@contfu/strapi/strapi-server` remains
available for setups that need an explicit server entry path.

Webhook payloads remain Service-owned dirty signals. Contfu stores service metadata such as
event names, scopes, Contentful revisions/versions, and Sanity transaction, document, dataset,
and perspective headers for diagnostics and buffering, but applications should use normalized
item properties and Contfu scopes rather than depending on service-specific webhook metadata.
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
Service's real route. Import the ones you want so they get stable Contfu IDs:

```bash
contfu integrations add <integration-id> --refs <comma-separated-refs>
contfu integrations add <integration-id> --all       # import everything
contfu integrations add <integration-id> --select    # interactive picker
```

Imported source collections then appear in `contfu collections list -f json` with numeric
`id`s — use those as `--source-id` when [wiring flows](./flows.md).

### Notion date ranges

Notion date properties are scalar by default. For native Notion date properties that use ranges,
enable **Treat as range** in the collection's Properties section. Contfu keeps the start under the
original property and adds a configurable paired end property; both are ordinary `DATE | NULL`
properties (or `PLAINDATE | NULL` when plain-date storage is also enabled). Changing this setting
updates the schema and requires a full resync. Previously discarded ends can only be recovered by a
fresh pull from Notion.

Notion `time_zone` values are not retained. Date-valued formulas and rollups remain start-only and
cannot be configured as ranges.

### Ephemeral Notion file URLs

Notion-hosted files use temporary URLs. Contfu records the earliest expiry it sees across a Notion page's file properties, icon, cover, and content blocks. Once that expiry passes, the cached source item is treated as stale: Contfu refreshes source content before it redelivers the item, so the Contfu runtime can receive current file URLs.

This freshness handling applies only to URLs that Notion marks as its own `file` URLs with an expiry. URLs from Notion's `external` file variant are not considered Notion-issued ephemeral URLs; their availability remains the external host's responsibility.

If the Contfu runtime encounters a missing, expired, or access-rejected Notion URL, it requests the normal targeted refresh/re-delivery path described in [Deployment](./deployment.md#sync-acceptance-and-media-repair). It is asynchronous and does not require Reset Source State or Reset Target State for ordinary URL expiry.

### Troubleshooting

| Problem                                          | Fix                                                                                                |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| OAuth consent screen doesn't show expected pages | The Service needs access granted. In Notion: open the page → `…` menu → Integrations → add Contfu. |
| Integration created but no source collections    | The scan may still be running. Wait, then re-run `contfu integrations scan <id>`.                  |
| "Not authenticated"                              | Run `contfu login`, or set `CONTFU_API_KEY`.                                                       |

## Application Integrations (Target Role)

An **Application Integration** represents your Application in Contfu. It is the
Contfu-side counterpart of the **Connector** your Contfu runtime uses, and it issues the API
key your app authenticates with.

### Create one

The `setup` command creates the app integration and installs the selected Contfu package together:

```bash
contfu setup --non-interactive \
  --package @contfu/client \
  --app-name my-app \
  --env-file .env
```

- `--package` — `@contfu/client` (query a remote Server) or `@contfu/contfu` (embed the
  Contfu runtime).
- `--app-name` — a slug for the app integration.
- `--env-file` — appends `CONTFU_KEY=<app-key>` to the given file.

If you only need the integration (no package install), create it directly:

```bash
contfu integrations create --name my-app --type app
```

Collections become visible to an app by being associated with its app integration
(`--integration-id <app-integration-id>` when creating them). See
[Collections](./collections.md#associating-collections-with-an-app).

### Webhook target integrations

Webhook Integrations are Target Role targets that receive item payloads over HTTPS. Create one
with an endpoint URL template and optionally a signing secret:

```bash
contfu integrations create --name "Search index webhook" --type webhook \
  --url "https://example.com/contfu/{collection}/{itemId}" \
  --webhook-secret <shared-secret>
```

Supported URL template parameters are `{collection}`, `{collectionName}`, and `{itemId}`.
Add static outbound headers with `--webhook-header "Name=Value[,Name=Value]"` and tune retry
handling with `--webhook-max-attempts` / `--webhook-delivery-window`. Contfu-managed content type,
version, timestamp, and signature headers take precedence over static headers.

#### Payload

Contfu sends a versioned `item.current_state` JSON body. The current wire contract is `2026-08-03`,
also sent in `contfu-webhook-version`. A current-state payload contains the target collection,
Contfu item ID, `changedAt`, `deliveredAt`, `props`, and optional `content`.

#### Timestamps and deletions

Both timestamps are ISO 8601 UTC strings with millisecond precision:

- `changedAt` is the authoritative content/state timestamp: the source item's epoch-millisecond
  `$changedAt`, rendered as ISO. It remains stable across queue retries and manual redelivery of
  one item version.
- `deliveredAt` is generated for each HTTP attempt and may change on retry. When a secret is
  configured, `contfu-webhook-timestamp` contains this same value.

Removal deliveries use the same payload shape with `deleted: true` and omit `props`/`content`.
They use the deletion state timestamp captured when the removal job is enqueued.

#### Signing

When a secret is configured, requests include
`contfu-webhook-signature: sha256=<hmac>` over `<timestamp>.<raw-body>`.

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
- **Quota Blocked** — synchronization stopped because the Organization exceeded its
  plan quota.

Neither state automatically raises an [incident](./flows.md#incidents); they are expected,
user-visible conditions.
