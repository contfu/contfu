# CMS recovery failure diagnostics

Acknowledged CMS target deliveries now retire obsolete failed-delivery diagnostics
for the same workspace, target collection, and item. Recovery of temporarily
unavailable source payloads clears failures even when the source revision is
unchanged. Older successes cannot clear newer failures; equal-revision successes
only clear failures for the same operation. Webhook delivery behavior is unchanged.

This affects shared CMS receive bookkeeping, not provider write semantics. No
database migration is required. Deploy/restart the backend and sync workers to
activate the fix; existing diagnostics retire on the next successful delivery,
not through a retrospective sweep.

# Replay-safe target delivery accounting

Automatic source replay now reuses funded delivery work across app replicas,
replacement pods, and publication retries. Explicit operator requests remain
chargeable; durable repair-job retries reuse their request cycle.

Quota debits and admission metadata commit in PostgreSQL before the existing
delivery worker publishes executable NATS obligations. Business transaction
rollback and broker publication failure cannot expose unfunded work. Funded
publication IDs fence stale outbox replay and preserve ACK/recovery semantics.
Unexpected funding-write errors leave repair jobs failed and release their
worker lease instead of failing again while recording binary SQL diagnostics.

Deploy the admission-table migration with the updated service. No application
SDK or client wire-protocol change is required. Existing quota usage and reset
dates are not modified; retrospective billing adjustments still require
verifiable evidence and owner approval.

# Connection-scoped item identity (breaking change)

Managed item IDs change for **all integrations**. Identity now includes the integration type,
stable service connection, source collection scope, and native key. Contentful environments,
Sanity datasets, and GitHub branches no longer share identities. Strapi content-type UIDs
and WordPress entity namespaces belong to native keys, not scopes.

**A full source and application resync is required.** Rebuild source memberships, cached
items, source schemas/reference-target metadata, downstream application stores, and references together before resuming incremental
sync. Regenerate application types to include optional `$scope?: string`. There is **no
rehash migration** for managed items: do not mix old IDs/state with new source identities.
Deploy the database migration and restart the backend/sync services before the coordinated
resync. Update the first-party Strapi and WordPress plugins together with the backend.

Collection configuration is updated to bare Sanity/GitHub refs; `collection.scope` is the
only fetch/identity scope, with no collection-option scope overrides. Existing native service
connections are resolved on first use, which requires valid credentials for GitHub/Notion.
Creating or changing an integration to a connection already used in the workspace is rejected.
Integration-ID fallback services (Strapi, Directus, WordPress, Web) remain independently creatable.

Application collection identity remains **name-based**. `$scope` is source-derived delivery
metadata, stored with item properties and filterable in the local query API. It is absent
for unscoped sources. See [system properties](./system-properties.md#source-scope).

## Web synthetic creation timestamp removal (payload compatibility change)

Web no longer adds the undocumented `createdAt` property to HTML, Markdown, or JSON items.
There is no replacement creation or publication timestamp. `Last-Modified` still supplies
`changedAt` (delivered as `$changedAt`), with fetch time as the fallback. Conditional requests
and stable content fingerprints are unchanged.

Review mappings, filters, sorting, and consumers that relied on the former synthetic field;
do not replace it with `$createdAt`. Schema-declared JSON `createdAt` remains ordinary source
content and is no longer overwritten. Legacy JSON `data` retains the original response.

Previously cached/downstream synthetic values may survive deployment: removal does not change
the Web fingerprint, and unchanged-page suppression or conditional 304 responses can skip
payload updates even during a conditional full pull. Rebuild affected cached source items
and downstream application stores through the supported full source and application resync
workflow, rather than relying on an ordinary unchanged refresh to remove the field.
Regenerate application types as needed. See [Web migration](./system-properties.md#web-migration).

## Incremental pull continuity

Incremental and best-effort pull version tracking now merges only observed items into
the transaction-current collection state. An overlapping Full pull can no longer
have its inventory erased by an incremental pull that captured an older empty
baseline; unobserved items removed by a concurrent Full are not resurrected either.
Authoritative Full omissions and explicit upstream deletions remain destructive.

Restart the backend/sync services after deployment. Existing missing projections
require a supported source Full recovery; this is explicit recovery, not proof of
automatic continuity or of Asset PUSH file-refresh success.
