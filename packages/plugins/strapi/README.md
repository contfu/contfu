# @contfu/strapi

Strapi v4/v5 plugin for sending signed Contfu webhooks.

## Install

```bash
npm install @contfu/strapi
```

## Configure

```ts
// config/plugins.ts
export default ({ env }) => ({
  contfu: {
    enabled: true,
    config: {
      webhookUrl: env("CONTFU_WEBHOOK_URL"),
      webhookSecret: env("CONTFU_WEBHOOK_SECRET"),
    },
  },
});
```

The package root is the Strapi plugin entry that Strapi loads after installation. The plugin registers static Strapi entry lifecycle handlers for Strapi v4 and v5 and sends the canonical v1 Contfu item envelope to `/webhooks/contfu/{uid}` through `@contfu/webhook`. It signs the exact UTF-8 JSON body with `x-contfu-signature: sha256=<hmac>` using the configured webhook secret and sends a signed `contfu.plugin.enabled` handshake at startup.

Each lifecycle push has a durable, integration-scoped monotonic sequence. Contfu records skipped sequences as gaps and schedules repair when supported. The sequence is stored in Strapi's persistent plugin store, so changing integrations does not share stream state. Allocation is serialized within a Strapi process; when running multiple Strapi writers, route lifecycle delivery to one writer (or provide an atomic store implementation) to preserve ordering. Retries must resend the same canonical body and sequence.

This plugin's pushes use `/webhooks/contfu/{uid}`.

If your Strapi setup needs an explicit server entry path, use `@contfu/strapi/strapi-server`; it exports the same plugin module as the package root.

## Strapi v4 notes

Contfu supports Strapi v4 and v5 as source integrations.

- The API token must read collection entries and Content-Type Builder schemas. On some v4 projects the schema endpoints live under `/content-type-builder/*` and require admin/elevated access rather than a regular Content API token.
- Draft sync uses Strapi v4 `publicationState=preview/live` and Strapi v5 `status=draft/published`. Contfu exposes `$draft` when draft sync is enabled.
- Plugin pushes use the generic Contfu endpoint and require `x-contfu-signature` in `sha256=<hex>` HMAC format.
- Strapi v4 `populate=*` is shallow, so deeply nested relations/components may need custom Strapi API configuration before Contfu can see them.

## Localized target delivery (Strapi v5)

The plugin also provides authenticated per-locale unpublish, schema, and grouping-key
lookup operations for Contfu localized targets. Enable the plugin on the receiver and
select Strapi v5 in Contfu. Use a content API token with find/create/update/delete access
to the target content type. The endpoints reject user-session/admin-token authentication
and check the token's permissions for the requested content type. Read-only tokens cannot
unpublish, and wildcard locales are never accepted. Signed source pushes remain optional
and independent of target delivery.

Configure a stable string/number grouping key and map `$locale` unchanged in Contfu.
Legacy bindings are not upgraded automatically: a workspace owner/admin must confirm an
audited repair in failed-delivery diagnostics. No manual editing of binding bytes is needed.
