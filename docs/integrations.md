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
token for public pages. A Web collection may also set the collection option `schemaUrl` to an
explicit JSON Schema or OpenAPI 3 document URL (relative URLs are resolved against `--url`):
`{"options":{"schemaUrl":"/schemas/article.json"}}`.
The schema URL must be HTTP(S) and same-origin; Contfu does not probe well-known paths. The
supported subset maps object properties, required/nullable fields, primitive formats, arrays,
and string enums. For OpenAPI, Contfu uses the GET response for the path matching the first
configured ref URL (including `{parameter}` paths), with paths sorted for deterministic ties;
there is no fallback to an unrelated path. Missing, unreachable, malformed, oversized,
unsupported, or non-matching documents silently retain the generic Web schema. Web schema
integrations are pullable, so a later document change is picked up by the existing schema-sync
workflow and follows its normal schema-change handling.

### Web source pushes

A Web source can also receive full-item changes immediately through the generic push endpoint. Configure a
push UID and webhook secret for the source integration, then give the web app the endpoint
`https://contfu.com/webhooks/contfu/<push-uid>` and the secret. Keep the secret server-side; it must not be
included in browser bundles. The app must persist one monotonic `sequence` across restarts and instances for
the integration (it is not a per-collection counter).

Install the shared TypeScript client:

```bash
bun add @contfu/webhook
```

```ts
import { createWebhookClient } from "@contfu/webhook";

const webhook = createWebhookClient({
  endpoint: process.env.CONTFU_WEBHOOK_URL!,
  secret: process.env.CONTFU_WEBHOOK_SECRET!,
});

await webhook.push({
  operation: "update",
  collectionRef: "articles",
  itemRef: "https://example.com/articles/article-42",
  sequence: nextDurableSequence(),
  occurredAt: new Date().toISOString(),
  properties: { title: "Hello" },
});
```

`collectionRef` must exactly match the source collection ref configured in Contfu, and `itemRef` must be the
absolute HTTP(S) URL produced by the Web pull. The client sends the exact JSON body with an
`X-Contfu-Signature: sha256=<hex>` HMAC-SHA256 signature.
Contfu rejects an invalid signature with `401`; duplicate delivery of the same sequence and body is
idempotent, while stale or conflicting sequences return `409`. Skipped sequences are accepted but recorded
and schedule `GAP_REPAIR` using the existing authoritative Web pull. Scheduled Web pulls remain the
reconciliation path for changes that were never pushed, so enabling pushes does not change pull behavior.

For WordPress, credentials are optional for published-only sync and
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
For Sanity, the repair does not rewrite an existing Studio-pushed schema; re-run the
Studio schema push after changing `includeDrafts` so a published-only collection no
longer retains `$draft`.

### WordPress push plugin

The optional **Contfu Push for WordPress** plugin sends post, media, and taxonomy
changes immediately to the source integration's generic push URL. Pulls remain
the reconciliation path when the plugin is absent. Download the repository zip
artifact (`contfu-wordpress-<version>.zip`) and install it from **Plugins → Add
New → Upload Plugin**; this plugin currently has an independent zip release
workflow and is not published through the Bun/npm workspace publisher.

In **Settings → Contfu Push**, enter the complete `/webhooks/contfu/{push-id}`
URL, the integration push ID, and the webhook secret shown by Contfu. Requests
are signed over their exact JSON bytes using `X-Contfu-Signature:
sha256=<hmac>`. Only administrators can edit settings, and the secret is never
shown again or logged. Rotate the secret in Contfu and the plugin together.

Each lifecycle event has a durable, per-integration sequence. Transient delivery
failures retry the same signed body and sequence (up to three attempts); a
skipped sequence is recorded by Contfu and schedules a full-pull gap repair.
If a database backup is restored to another live site, configure a separate
Contfu source integration rather than sharing its sequence stream.

The Contfu integration’s draft setting is authoritative; omitted or explicitly
disabled settings use the published-only view. Draft-only changes are ignored,
and a published item moved to draft, unpublished, or trash sends an immediate
delete signal because it is no longer in that view. With **Push drafts and
trashed records** enabled, post/media payloads include `$draft: true` for unpublished states and
trash is represented as a soft-deleted source item until WordPress permanently
removes it. Taxonomies never synthesize draft state. Verify delivery in the
integration push diagnostics; scheduled full pulls continue to reconcile missed
or permanently deleted records.

### Sanity Studio schemas

Install `@contfu/sanity` in a Sanity Studio and call `updateContfuSchema` from
`sanity.cli.ts` to push the Studio schema. A pushed schema is authoritative for
that collection; until the first push, Contfu falls back to item-derived schema
sampling during the initial full pull. Schema pushes use the dedicated
`/webhooks/sanity/schema` endpoint and are separate from item webhook payloads.
When `includeDrafts: false` is enabled, the push path removes `$draft` from the
schema before storing it. This applies to future schema pushes; it does not
rewrite an already stored schema, so re-run the Studio schema push after
changing draft mode to repair an existing collection schema.

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
`x-contentful-signature` plus `x-contentful-timestamp` and Sanity webhook signatures.

The first-party item-push senders, including `@contfu/strapi`, use the canonical JSON contract
and signature described in the sections above.

### Generic webhook ingress

Contfu-controlled senders, including `@contfu/strapi`, WordPress Push, and Web
apps, use `/webhooks/contfu/{uid}` with the canonical JSON item-push contract,
`X-Contfu-Signature`, and the integration push secret.

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
etc. — each with `ref`, `displayName`, and `alreadyAdded`. If a Strapi read credential cannot access
Content-Type Builder, setup offers two supported paths:

1. **Schema credential:** provide an optional setup-only credential with Content-Type Builder access.
   It is stored separately from the read credential and is used only for schema discovery.
2. **OpenAPI:** opt in to Strapi 5's public OpenAPI document in `config/server`:

   ```js
   openapi: { "content-api": { access: "public" } }
   ```

   Contfu probes `GET /api/openapi.json` with the read credential. Collections are offered only
   when the document explicitly identifies their UID and localization behavior; unsupported or
   ambiguous fields are skipped rather than inferred from content. Explicit route mappings and
   sampled-content schema inference are not supported.

Sanity scans are conservative:
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
original property and adds a configurable paired end property; both are ordinary `DATE | OPTIONAL`
properties (or `PLAINDATE | OPTIONAL` when plain-date storage is also enabled). Changing this setting
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
