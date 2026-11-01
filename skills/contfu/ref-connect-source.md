# Connecting a CMS Source

## Overview

Contfu connects to CMS services via the web UI. OAuth providers (e.g. Notion) handle authorization automatically; token-based services (Strapi, Contentful, Web) require pasting an API token.

## Steps

### 1. Authenticate with Contfu

Ensure the user is logged in:

```bash
contfu login
```

### 2. Identify the integration type

List available integration types:

```bash
contfu integrations types
```

This outputs type names like `notion`, `strapi`, `contentful`, `web`, `client`. Use the matching name in the deep link.

### 3. Create the integration via deep link

Direct the user to the new-integration page with the type pre-selected:

```
https://contfu.com/integrations/new?type=<type-name>
```

For example: `https://contfu.com/integrations/new?type=notion`

- **OAuth providers** (e.g. `notion`): the OAuth flow starts automatically — the user just authorizes in the consent screen.
- **Token-based services** (e.g. `strapi`, `contentful`, `web`): the form is pre-filled with the correct service; the user enters a name and API token.
- **App integrations**: use `?type=app` to jump to the app tab.

### 3a. Sanity — ask for a Developer token

**When connecting Sanity, ask the user for a token with the Developer role, not Editor.** Request it up front, at the same time as the project ID — discovering the missing grant later means going back to the user mid-setup.

An Editor token is enough to read and write dataset content, so seeding and querying work and nothing looks wrong. It is **not** enough to manage project webhooks:

```
401 {"error":"Unauthorized",
     "message":"User must have grant sanity.project.webhooks/read to perform this operation"}
```

Without webhook management, Contfu falls back to polling the Content Lake, which is slower and bills against the user's Sanity API usage. A Developer token covers both content and webhooks, so it is the only token worth asking for.

Sanity needs three things, all obtained at <https://sanity.io/manage>:

| Value           | Used for                                                                                                                                        |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Project ID      | `contfu integrations create --project-id`                                                                                                       |
| Developer token | `--token`, and creating the webhook                                                                                                             |
| Dataset name    | Defaults to `production`; not configurable via the CLI — `--dataset` is accepted and silently dropped, and `opts.dataset` is stripped on update |

The integration requires the token even when the dataset is publicly readable. Without it `contfu integrations scan` fails with a bare `500`, not a credentials error, so treat any 500 from `scan` as a missing-token symptom first.

### 3b. Sanity — create the content-change webhook

This is separate from `@contfu/sanity`, which pushes the Studio _schema_. This webhook reports _content_ changes so Contfu can stop polling. Both share one secret.

1. Generate a secret and register it: `contfu integrations update <id> --webhook-secret <secret>`.
2. Create the Sanity webhook against the management API. Use the CLI's current `HOOK_API_VERSION` (read it from `@sanity/cli/dist/actions/hook/constants.js`; `v2025-08-04` at time of writing) — older versions reject `secret` outright and silently produce an unusable hook.

```
POST https://api.sanity.io/<HOOK_API_VERSION>/hooks/projects/<projectId>
Authorization: Bearer <developer-token>

{ "type": "document", "name": "contfu",
  "url": "https://contfu.com/webhooks/sanity",
  "dataset": "production", "httpMethod": "POST",
  "apiVersion": "v2021-03-25", "includeDrafts": true,
  "rule": { "on": ["create","update","delete"] },
  "secret": "<secret>" }
```

Gotchas, each of which fails quietly rather than loudly:

- `type` must be `document`. The default is `transaction`, which accepts no `secret` — Contfu then rejects every delivery with 401.
- `on` is **not** a top-level key for `document` hooks; it nests inside `rule`. A hook created without `rule` is accepted, enabled, and never fires.
- `filter` and `projection` are not top-level keys either. Leaving them unset means all documents and the whole document body, which is what Contfu wants.
- `sanity hooks create` is interactive only and cannot be scripted.

Verify delivery by changing one document and polling
`/hooks/projects/<projectId>/<hookId>/attempts`. Do not read the hook object back with a plain dump — the response includes `secret` in cleartext.

### 4. Verify the integration via CLI

```bash
contfu integrations list -a
```

The new integration should appear with its ID and name.

### 5. Discover collections

After the integration is created, integrations scan available source collections:

```bash
contfu integrations scan <integration-id> -a
```

This shows the available source collections (Notion databases, Strapi content types, etc.) with `ref`, `displayName`, and `alreadyAdded` fields.

### 6. Next steps

Once connected, the user typically wants to:

- **Create collections and flows** to sync data → load `ref-collections-flows.md`
- **Set up a client** to query the synced content → load `ref-client-sdk.md`

## Troubleshooting

| Problem                                          | Fix                                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Sanity `scan` returns `500`                      | Missing credentials. Set a Developer token with `contfu integrations update <id> --token <token>`                               |
| Sanity webhook management returns `401`          | The token is Editor-role. Replace it with a Developer token — see step 3a                                                       |
| Sanity webhook exists but never fires            | It was created without `rule.on`. See step 3b                                                                                   |
| Sanity webhook delivers but Contfu answers `401` | Signature mismatch — the secret registered with `--webhook-secret` differs from the one on the Sanity hook                      |
| OAuth consent screen doesn't show expected pages | The CMS integration needs access granted — e.g. in Notion, open the page > "..." menu > "Integrations" > add Contfu integration |
| Integration shows but no source collections      | The scan may still be running. Wait a moment and re-check with `contfu integrations scan <id> -a`                               |
| "Not authenticated" error                        | Run `contfu login` or set `CONTFU_API_KEY`                                                                                      |
