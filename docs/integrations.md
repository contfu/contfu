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

Currently available types: `notion`, `strapi`, `contentful`, `wordpress`, `sanity`, `github`, and `web`.
Services use these authentication styles:

- **OAuth providers** (e.g. Notion) — authorization happens in a browser consent screen.
- **GitHub App installations** — install the deployment-configured Contfu GitHub App with read-only Contents permission for selected repositories and enter its numeric installation ID.
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
- `?type=github` — install the configured Contfu GitHub App with read-only Contents permission for the public and/or private repositories you select, then enter its numeric installation ID. Contfu stores the installation identity, not the short-lived access tokens it obtains from GitHub. GitHub Enterprise is not currently supported.
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

### GitHub source

Create a GitHub Service Integration in the web UI with `?type=github`. After creation, use the
standard CLI workflow to discover and import repositories:

```bash
contfu integrations scan <integration-id>
contfu integrations add <integration-id> --select
# Or, in a non-interactive environment, import every authorized repository:
contfu integrations add <integration-id> --all
```

Use `--select` rather than copying a scanned GitHub ref into `--refs`: GitHub repository refs are
opaque JSON values that contain commas, while the CLI treats commas as separators between refs.
Scanning exposes each repository authorized for the GitHub App installation as a source
collection rooted at the repository root. The repository's default branch is selected initially.
For an imported collection, **Branch or ref scope** is the Contfu **Scope**; **Repository
directory** optionally moves the collection root below the repository root; and the case-sensitive
**include glob**, relative to that directory, refines membership. The include glob defaults to
`**/*`. Changing the directory, Scope, or include glob reconciles collection membership.

One matching file becomes one item. Supported document extensions are `.md`, `.markdown`,
`.html`, `.htm`, `.json`, `.yaml`, and `.yml`. Markdown YAML frontmatter becomes item properties
and the Markdown body becomes Contfu rich content. HTML becomes rich content. JSON and YAML must
each contain one object, whose fields become item properties; arrays of records do not become
multiple items. Contfu infers a proposed schema from the selected documents for you to confirm.
After confirmation, Contfu maintains the collection schema rather than silently adopting later
repository shape changes.

GitHub push events accelerate reconciliation of the affected repository and Scope, while periodic
and full polling remains authoritative and repairs missed pushes or deletions. Each synchronization
reads current content from one fixed commit; it does not replay every intermediate commit. GitHub
currently supports **Content Provide** only, not Content Receive. It does not infer draft,
publication, or locale semantics from property names or directory layout: those values remain
ordinary properties, so use existing Flow filters and localization configuration where needed.

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

A **Scope** is an optional group of collections within one service connection.
A collection has at most one scope; `collection.scope` is the single source of truth
for fetching and identity, not a collection ref or an options override.
Service-native concepts map onto scopes:

| Service    | Scope is…       |
| ---------- | --------------- |
| Sanity     | a dataset       |
| Contentful | an environment  |
| GitHub     | a branch or ref |

When no scopes are configured, the integration exposes the Service's default scopes, or
all accessible scopes when the Service can enumerate them. Scopes also disambiguate two
service collections that share a native name within one integration.

> In Contfu terminology and persisted state, always speak of **scopes** — the
> service-native words (dataset, environment) are only useful for finding the setting
> in that Service's own UI.

Collection namespaces are not scopes: Strapi content-type UIDs, Directus collection names,
and WordPress kind/restBase belong in the native key. Native keys exclude connection and
scope and are unique within that pair.

Managed identity is uniformly `hash(type, connection, scope, native key)`. Connection means
Sanity projectId, Contentful spaceId, GitHub account/owner ID, or Notion workspace ID;
Strapi, Directus, WordPress, and Web use the Contfu integration ID. A workspace permits
at most one integration per native connection of the same service type. The same native
document in two scopes has distinct managed IDs. Application collections remain name-based;
optional, typed and filterable [`$scope`](./system-properties.md#source-scope) identifies
an item's source scope.

### Scoped references

All adapters share a versioned reference envelope with `{connection?, scope?, collection?, key}`.
A bare key means the same connection and scope with one target collection. The envelope is
used when the destination differs or the field has multiple target collections; it replaces
the former Strapi-specific `strapi-ref:v1` format. This is a reference contract, not raw
OBJECT preservation of provider metadata.

Sanity cross-dataset references and Contentful ResourceLinks are typed relations into the
target scope's collections. Polymorphic fields retain each value's target collection and
generate unions of the target item types. Contentful rich-text entry and resource hyperlinks
use the same reference resolution; embedded entry blocks remain components.

Unsynced targets retain stable pending identities, just like local references to unsynced
collections, without an extra diagnostic. Synchronizing the target makes the relation
available without refetching the referencing item. See [release notes](./release-notes.md)
for the required coordinated full resync after the identity change.

### Cross-connection references

Sanity global and cross-project references and Contentful cross-space ResourceLinks
retain the target's native project or space identity. Contfu matches only integrations
of the same service in the same workspace. Target discovery uses the matched
integration's credentials and options; source credentials are never sent to a foreign
project or space.

Target items retain connection/scope/key-based registry identities. An unavailable
connection does not prevent delivery of the source content: native reference provenance
is retained durably, and unavailable application relations are withheld until an active
target flow supplies an unambiguous destination. Target sync and routing changes repair
relations from cached source data without fetching the source provider again.

Contentful keeps its existing localized native keys. An explicitly unlocalized target
uses its bare entry ID; a localized target uses the selected locale. Missing target
default-locale metadata remains unresolved rather than guessing a locale or changing
an existing identity. Rescan collections when localization metadata changes.

Apply the service migration and restart the backend and sync workers after deployment.
Existing source items need a pull to capture foreign provenance previously discarded
by adapters. No cross-connection service-URL recognition is added.

### Service URLs as references

GitHub, Sanity and Contentful recognize identity-verifiable HTTPS service links in
rich content and in properties declared as `REF` or `REFS`. Ordinary string
properties are not rewritten. Recognized links use the same item identity as
native references, including a scope qualifier when the destination is in another
scope.

Supported forms:

- GitHub: `https://github.com/<owner>/<repo>/blob/<ref>/<path>`. The repository
  must belong to the connection's verified installation, and the path must have a
  supported document extension. Branch and tag names are checked against repository
  metadata, including names containing slashes; ambiguous ref/path splits remain
  URLs. The equivalent `tree` route is recognized only when repository metadata
  confirms that the path is a document file, not a directory.
- Sanity: `https://<projectId>.api.sanity.io/<apiVersion>/data/doc/<dataset>/<documentId>`,
  with a date-versioned API path, the configured project and exactly one document
  ID. Draft IDs resolve to their published identity. Opaque Studio routes do not
  prove project, scope and document identity and remain URLs.
- Contentful: `https://app.contentful.com/spaces/<spaceId>/environments/<environmentId>/entries/<entryId>`,
  requiring the configured space. The older `/spaces/<spaceId>/entries/<entryId>`
  form means the `master` scope, not the source item's current scope. Destination
  localization metadata determines whether the referenced key includes a locale.

Public-site links, unsupported routes, malformed identities and links into other
connections stay unchanged. No public URL patterns, slug lookup or cross-connection
discovery are performed. A recognized identity still needs a configured destination
flow to resolve to an item in an application.

**Resync existing source items** to apply recognition to previously synchronized
content; deployment does not retroactively rewrite stored items.

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

### Planned publication

With draft sync enabled, `$scheduledAt` reports the earliest pending publication
of the version Contfu synchronizes. It is optional and does not mean the item has
already been published. See [System properties](./system-properties.md).

| Service    | Availability                                                                                                                                                                                                                                      |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WordPress  | Scheduled posts, with permission to read non-published content.                                                                                                                                                                                   |
| Contentful | Preview collections with a Management token that can read Scheduled Actions; includes Launch schedules for working entries.                                                                                                                       |
| Sanity     | Scheduled Publishing, with an authenticated token that can read schedules.                                                                                                                                                                        |
| Strapi     | Content Releases. In **edit Strapi**, enable **Include publication schedules** and draft sync, and provide a schema credential with admin Content Releases read permission. This explicitly allows that credential to read schedules during sync. |

Schedules for separately staged release versions in Contentful or Sanity are not
attached to the current preview item. Without scheduling access, `$scheduledAt`
is absent. Custom date fields in other services remain ordinary content fields.

The source controls publication, including postponements and cancellations.
Contfu never publishes a cached item when its planned time arrives. Pushes report
source changes, and polling reads the source again; full pulls reconcile missed
changes. An overdue schedule remains a plan until the source publishes it, so
changes are not guaranteed to appear at the exact scheduled time. WordPress
scheduled posts remain drafts; after publication, `$publishedAt` replaces
`$scheduledAt`.

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

The plugin resolves named type aliases and maps supported scalar/object types
and compatible homogeneous arrays. Unresolved custom field types and ambiguous
or unrepresentable arrays are omitted with plugin-side structured diagnostics;
reference destination restrictions are reported but not encoded in generic
Contfu `REF`/`REFS` types. Direct document-field `.required()` is the only
validation rule mapped to Contfu optionality. Other validation rules, nested
and member constraints, and editor-only `hidden`, `readOnly`, or custom input
behavior are diagnosed or intentionally omitted. Diagnostics are logged by default by the helper or can
be collected with its `onDiagnostic` option; they are not part of the posted
schema contract. Because a push replaces the stored authoritative schema,
omitted fields can remove properties from an existing collection.

### Deletions from polling sources

WordPress source collections use authoritative scheduled full pulls for deletion reconciliation:
Contfu compares the latest REST listing with the last successful upstream item snapshot and emits
delete sync messages for WordPress items that disappeared. Downstream consumer collections can then
remove items that were deleted in WordPress instead of waiting for a Service webhook. In WordPress
draft sync, a post/media record that moves to `trash` emits a tombstone once and remains tracked as
soft-deleted source state until WordPress stops returning it or it is restored.

### Webhook signing and Service diagnostics

For Contentful and Sanity source webhooks, store the signing secret on the integration with
`--webhook-secret` or the equivalent UI field. These routes verify the raw webhook body before
parsing when a secret is configured. Their supported schemes include Contentful's
`x-contentful-signature` plus `x-contentful-timestamp` and Sanity webhook signatures.
Notion instead uses deployment-global enrollment and signing credentials, as described below.

Details for the first-party item-push senders, including `@contfu/strapi`, are in the
[Contfu item push contract](./private/specs/contfu-item-push.md).

#### Notion source webhooks

Customers connect Notion through the browser OAuth consent flow, grant access to the desired
pages/databases, and [discover and import source collections](#discover-and-import-source-collections).
There is no per-integration webhook-secret or CLI enrollment step for Notion. Push delivery
depends on the deployment operator enrolling the shared Notion OAuth webhook once for the
deployment, not once per workspace.

**Operator enrollment:**

1. Configure the deployment's `NOTION_WEBHOOK_SECRET` with a private endpoint UID (`<uid>`).
   This value selects the endpoint; it is not the signing key. Apply the deployment configuration
   before enrollment.
2. In Notion's OAuth integration webhook settings, register
   `https://<contfu-host>/webhooks/notion/<uid>`.
3. Let Notion send its `verification_token` to that endpoint. Contfu accepts this enrollment
   request without an event signature and stores the token encrypted.
4. As a Contfu administrator, open **Admin → Settings** (`/admin/settings`), copy
   **Notion OAuth Verification Token**, and paste it into Notion's webhook verification UI.
   This is shared deployment state: do not repeat enrollment for individual customer connections.

Subsequent event requests must carry `X-Notion-Signature: sha256=<hex>`, an HMAC-SHA256
over the exact request body bytes using the verification token as the signing key. The
verification token, endpoint UID, and OAuth access token are distinct; keep them private.
Unlike the Contentful and Sanity routes, the Notion route parses and validates the payload
before checking event signatures.

Contfu maps these notifications to source changes:

- `page.created`, `page.content_updated`, `page.properties_updated`, `page.moved`,
  `page.deleted`, and `page.undeleted`.
- `database.schema_updated`, `database.moved`, `database.deleted`, and `database.undeleted`,
  and the equivalent `data_source.*` events, plus `data_source.content_updated`.

Page signals require a parent collection identity (a data-source ID or database ID) and route
only to matching imported collections. `page.locked` and `page.unlocked` are ignored.
Other `page.*` names fall back to a generic item-change signal; other unsupported event
types have no mapping and are ignored.

The endpoint returns `404` for an invalid or unconfigured UID, `400` for invalid JSON or
payload shape, and `413` for bodies larger than 1 MiB. Outside enrollment, missing signing
credentials or a missing/invalid signature returns `401`. Authenticated but unmapped or
incomplete signals (including missing event type/entity or parentless page signals), and
signals with no matching imported collection, receive `200` without synchronization.
A successful acknowledgement is not proof that content was synchronized.

Notion pushes are **best-effort change notifications**, not full content or a complete
deletion stream. Recognized delete signals can trigger deletion handling, but missing parent
information does not establish a delete. Workers fetch or reconcile current state rather
than treating notification bodies as authoritative content. Keep scheduled polling and full
pulls enabled to repair missed, incomplete, or out-of-order notifications. Operators can see
the [integration sync strategy](./private/specs/integration-sync-strategy.md) for reconciliation details.

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

1. **Schema credential:** provide an optional credential with Content-Type Builder access.
   It is not used to read content. Reading Content Releases with this credential requires
   opting in to **Include publication schedules**.
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

### Notion locations

Notion `place` (location) properties are discovered as optional geographic fields and normalized
as `GeoPoint` values: `{ lat: number, lon: number }`. Empty locations are explicitly `null` in
source items. Both coordinates must be finite numbers; malformed non-null locations fail the pull
or single-page fetch with a non-retryable validation error identifying the property. Zero coordinates
are preserved. Place names, addresses, and provider IDs (including AWS and Google place IDs) are
intentionally omitted; use separate Notion properties if your application needs that metadata.

Location fields support the existing null-check filters only, not geographic search. This support
is read-only and does not add Notion place write-back. For existing collections, refresh the source
schema and pull fresh items, then regenerate application types to expose the optional `GeoPoint` field.

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

### Strapi localized target setup

In setup or **edit Strapi**, explicitly select the remote **Strapi API version**.
Existing integrations without a selection stay in v4-compatible/non-localized target
mode. For localized targets select **v5** and install the updated `@contfu/strapi` plugin
on the receiver. The content API token needs `find`, `create`, `update`, and `delete`
permissions on the target content type; read-only tokens cannot unpublish. The plugin
accepts only content API tokens and checks the requested content type's permissions.
No admin or schema credential is used for localized writes or plugin lookups.

Configure collection localization, a stable scalar grouping key, and an unchanged
`$locale` mapping before activating the flow. See [localized Strapi delivery and repair](./i18n.md#localized-strapi-targets-v5-only)
for versioned bindings, publication behavior, and quarantined-binding recovery.
