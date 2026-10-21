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
