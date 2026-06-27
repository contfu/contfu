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

The package root is the Strapi plugin entry that Strapi loads after installation. The plugin registers static Strapi entry lifecycle webhook handlers for Strapi v4 and v5 and sends `x-strapi-signature: sha256=<hmac>` over the exact JSON request body using the configured webhook secret.

If your Strapi setup needs an explicit server entry path, use `@contfu/strapi/strapi-server`; it exports the same plugin module as the package root.

## Strapi v4 notes

Contfu supports Strapi v4 and v5 as source integrations.

- The API token must read collection entries and Content-Type Builder schemas. On some v4 projects the schema endpoints live under `/content-type-builder/*` and require admin/elevated access rather than a regular Content API token.
- Draft sync uses Strapi v4 `publicationState=preview/live` and Strapi v5 `status=draft/published`. Contfu exposes `$draft` when draft sync is enabled.
- Native Strapi v4 webhooks are accepted, including payloads that only contain numeric `id` values. Contfu uses `String(id)` as the item ref when `documentId` is absent.
- Signed webhook verification requires `x-strapi-signature` or `x-webhook-signature` in `sha256=<hex>` HMAC format. The Contfu plugin sends this format; built-in Strapi v4 webhook secret behavior can differ by version/plugin.
- Strapi v4 `populate=*` is shallow, so deeply nested relations/components may need custom Strapi API configuration before Contfu can see them.
