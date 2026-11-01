---
name: contfu
description: Set up, extend, model, or develop Contfu integrations — connect a CMS through the CLI, create collections and flows, manage resources, wire up app queries, design content schemas, or add service-side CMS integration support. Use when the user says "connect to Notion", "set up contfu", "add contfu to my project", "create a collection", "model content", "wire up my content", "add another collection", "update a flow", "add support for a CMS", or asks for Contfu integration work.
---

# Contfu Setup

You help users set up or adapt Contfu in their projects. This is the single Contfu skill: use it for CLI-driven setup, content modeling, app integration, and service-side CMS integration development. Be suggestion-driven — discover existing state, present options, and guide the user through choices. Never dump a checklist.

Treat app integration as part of setup, not a follow-up idea. If the repo already contains mock content, placeholder arrays, or fixture-driven loaders for content that now exists in Contfu, replace that scaffolding with a real Contfu query when it is safe and the intent is clear.

This skill should be strong enough to complete a full app integration in one go, but also to handle narrower Contfu maintenance tasks without dragging in unnecessary context. Examples:

- Set up a brand-new app integration, collections, flows, generated types, and query wiring.
- Add another collection and flow to an existing app integration.
- Update or inspect existing integrations, collections, or flows.
- Adapt an existing app integration when new Contfu-backed content needs to appear in the UI.

Use progressive disclosure. Start with the skill entrypoint and status discovery, then load only the next reference doc needed for the specific task. Do not pre-load every reference "just in case".

## Bootstrap

Run this automatically when the skill is invoked. Do not ask before running — just run and present results.

### Step 1 — Get full setup status

```bash
contfu status -a
```

This returns compact TOON with the IDs, names, types, relationships, counts, and status needed for setup decisions. The default format is intended for human terminal use. Add `--full` only when the compact fields do not answer the question; use JSON only when another tool requires it. If the CLI is not found, try `bunx @contfu/cli setup` or `npx @contfu/cli setup`. If none work, tell the user to install: `npm install -g @contfu/cli`.

If `authenticated` is `false`, guide the user to run `contfu login` first. Do not proceed until authenticated.

### Step 2 — Present the situation

Parse the agent response and build a short, readable summary. Integration type labels are in the `typeLabel` field (e.g., "notion", "app", "strapi"). Key distinctions:

- **Source integrations** (`typeLabel`: notion, strapi, contentful, web) — CMS data sources
- **App integrations** (`typeLabel`: app) — the user's app consuming content

Present what exists and what's missing. Examples:

> **Your Contfu setup:**
>
> - Notion integration: "My Workspace" (id: 3)
> - 3 collections: Blog Posts, Authors, Projects
> - Blog Posts has a flow from Notion, but Authors and Projects are unwired
> - No app integration for this project yet
>
> Want me to wire up Authors and Projects, or set up an app integration first?

> **Your Contfu setup:**
>
> - No integrations yet
>
> Let's connect your CMS first. Are you using Notion, or something else?

### Step 3 — Suggest and guide

Based on what's missing, suggest the next step. When the user picks a source integration to explore, scan what's available:

```bash
contfu integrations scan <integration-id> -a
```

This returns compact available source collections (Notion databases, Strapi content types) with `ref`, `displayName`, `scope`, and `alreadyAdded` fields. Add `--full` only to inspect service metadata such as schemas, locales, or options. Present them as a pick list.

When the user confirms which source collections should be wired into Contfu, add them directly from the CLI:

```bash
contfu integrations add <integration-id> --refs <comma-separated-refs>
# or
contfu integrations scan <integration-id> --select
```

Use `--all` only when the intent is clear and every scanned collection should be added.

After collections are added, numeric Contfu source collection IDs are available via `contfu integrations get <id>` and `contfu collections list -a`. Use those numeric IDs (not the upstream UUID refs) as `--source-id` when creating flows.

CLI users may reference workspaces, integrations, and collections by exact name in commands that take those refs. Agents should still prefer IDs captured from CLI/API output because IDs are stable and avoid ambiguous-name failures. Use names only when the user supplied them or an ID is not available yet.

Route the work into one of these modes after scanning:

- **Full integration** — the app is not fully wired yet, and you should carry the work through integration, collections, flows, generated types, and code integration.
- **Resource maintenance** — Contfu setup exists, and the task is to inspect, add, update, or delete an integration, collection, or flow.
- **Content modeling** — the task is to design collections, property schemas, relationships, and CMS field mappings before resources are created or flows are wired.
- **App adaptation** — Contfu resources already exist, and the task is to update the app code to consume them correctly.
- **Integration development** — the task is to add or debug service-side support for a CMS service in `packages/service/integrations/src/`.

### Step 4 — Wire the app code when an app already exists

Once the project has an app integration and relevant collections, inspect the repo and finish the integration:

1. Ask the user whether the app should embed the local Contfu runtime or query a user-hosted Contfu Server, then install the matching package. Do not infer this from the repo.
2. Generate TypeScript types from the CLI before writing query code.
3. Create a central typed Contfu query-builder module in the app's existing data-access layer.
4. Search for mock content, placeholder arrays, fixture-based loaders, or TODO scaffolding that should now come from Contfu.
5. Replace those placeholders with real queries when the mapping is clear.
6. Import that shared query builder wherever content needs to be fetched.
7. Remove the now-unused mock data and imports.

Rules for this step:

- **Ask the user which runtime they want before installing anything.** There is no safe default — the two are different deployment architectures, not a preference:
  - `@contfu/contfu` — embedded runtime and local store. `connect()` receives Sync Messages and applies them to a local SQLite database, and the app queries it in-process. No extra service to deploy.
  - `@contfu/client` — HTTP client that queries a **user-hosted `@contfu/server`**. Requires the user to run and deploy that Server themselves, and to supply its base URL.
- `@contfu/client` is useless on its own. `contfu.com` is the control plane and does **not** serve the query API; app integrations have `url: null` by design. Installing `@contfu/client` without a Server already running leaves the app unable to read anything, and the failure appears late, as a 404 returning the marketing SPA's HTML.
- If the user has no Contfu Server and no plan to run one, `@contfu/contfu` is the answer.
- Generate types with `contfu integrations types <app-integration-id>` for the whole app integration. Use `contfu collections types <collection-id>` only when the integration is intentionally scoped to a single collection.
- Save generated types into the project and use the resulting `Collections` type as the generic on the central Contfu query builder.
- Put Contfu query builder in one shared server/data module. Do not create separate client instances in each route, page, or component.
- Import that shared query builder into loaders, server modules, repositories, or other content-fetching code paths that need it.
- Reuse existing server-side loaders, data utilities, or repository modules. Do not scatter Contfu calls directly across presentational components unless the project already works that way.
- If the repo contains obvious sample content such as mock events, sample posts, or hardcoded content cards that correspond to a live Contfu collection, replace them with a real typed query instead of leaving both paths in place.
- Keep the query narrow and purposeful for the screen being built. Do not fetch every field "just in case".
- After wiring the live query, run the project's relevant checks so type mismatches from generated types are caught immediately.

### Step 5 — Model content when schema decisions are needed

Use this mode when the user asks to model content types, map CMS fields, or plan collections and relationships.

Core modeling rules:

- A **collection** maps to an upstream content type: Notion database, Strapi content type, Contentful content type, Sanity document type, etc.
- An **item** has `id`, upstream `ref`, `collection`, `createdAt`, `changedAt`, structured `props`, and optional rich `content` blocks.
- Use properties for metadata, taxonomy, references, settings, media URLs, and queryable fields.
- Use content blocks for long-form rich text, headings, lists, code, callouts, media embeds, tables, and nested prose.
- Model relationships as `Buffer[]` references, including single-item relation arrays.
- Prefer explicit, stable fields such as `slug`, `publishedAt`, `order`, and relation refs when the app will query or route by them.

Property schema shape:

```typescript
interface CollectionSchema {
  properties: {
    [key: string]: {
      type: "string" | "number" | "boolean" | "string[]" | "number[]" | "ref[]";
      required?: boolean;
    };
  };
}
```

Migration checklist:

1. Inventory upstream content types/databases.
2. Map CMS fields to Contfu property types.
3. Decide which rich fields belong in `content` blocks.
4. Model references and self-references as `ref[]`.
5. Decide how media URLs are stored.
6. Confirm sync capabilities needed for updates/deletes.

### Step 6 — Develop or debug service-side CMS integration support

Use this mode when the user asks to add support for a new CMS platform or fix service sync behavior in Contfu codebase.

All service integrations implement the contract in `packages/service/integrations/src/`:

```typescript
interface Integration<T extends IntegrationFetchOpts = IntegrationFetchOpts> {
  type: IntegrationType;
  syncCapabilities?: IntegrationSyncCapability[];

  buildFetchOpts(config: IntegrationFetchConfig): T;
  fetchFull?(opts: T): AsyncGenerator<Item>;
  fetchIncremental?(opts: T & { since: number }): AsyncGenerator<Item>;
  getCollectionSchema(opts: T): Promise<CollectionSchema>;
}
```

Implementation sequence:

1. Create `packages/service/integrations/src/{cms-name}/`.
2. Define CMS-specific fetch options extending `IntegrationFetchOpts`.
3. Declare sync capabilities using `IntegrationSyncMethod.PUSH`, `IPULL`, or `FPULL`.
4. Implement full and/or incremental fetch as async generators; yield `Item` objects sorted by `createdAt` ascending.
5. Implement `getCollectionSchema()` when the service exposes schema information.
6. Transform service rich content into Contfu `ContentBlock` values from `@contfu/core`.
7. Export the integration from its local `index.ts` and register it in `integrations.ts`.
8. Add focused `*.spec.ts` coverage for pagination, block transformation, errors, and pull cursors.

Reference implementations:

- `references/notion-integration.md` — Notion service integration structure and implementation notes.

Run targeted tests with:

```bash
cd packages/service/integrations
bun test src/{cms-name}/
```

### Step 7 — Manage existing Contfu resources when setup already exists

If the user is not asking for a full setup, work directly against the existing resources:

1. Inspect the current integrations, collections, and flows from CLI output.
2. Identify the exact app integration, source integration, and target collection involved.
3. Make only the minimal resource changes needed for the task.
4. If the change affects app-visible content, continue into app adaptation and update the code integration too.

Typical examples:

- add one more source collection from an existing Notion integration
- create a new target collection on an existing app integration
- wire a new flow from an existing source collection into that target
- regenerate types and update the app's shared query builder so the new collection can be queried

When adding another collection to an existing integration, prefer this sequence:

1. scan available source collections
2. add the selected source collections to Contfu
3. create or identify the target collection on the existing app integration
4. create the flow
5. regenerate integration-wide types
6. update the central `cq` module consumers where the new content is needed

## Routing to reference docs

When you reach a specific workflow, read only the relevant reference doc (same directory as this file). Do not bulk-load all references.

| Workflow                                 | File                               |
| ---------------------------------------- | ---------------------------------- |
| Connecting a CMS source                  | `ref-connect-source.md`            |
| Creating collections & flows             | `ref-collections-flows.md`         |
| Client SDK, types, querying              | `ref-client-sdk.md`                |
| Managing or extending an existing setup  | `ref-maintenance.md`               |
| Service-side CMS integration development | `references/notion-integration.md` |
| CLI command help                         | `ref-cli-reference.md`             |
| Full end-to-end walkthrough              | `ref-project-setup.md`             |

Reference loading rules:

- For full onboarding, start with `ref-project-setup.md`, then load `ref-connect-source.md`, `ref-collections-flows.md`, or `ref-client-sdk.md` only when you reach that step.
- For resource-only changes, prefer `ref-maintenance.md` and `ref-collections-flows.md`.
- For app-code changes, prefer `ref-client-sdk.md`.
- For service-side CMS service work, use the inline integration-development section first, then load `references/notion-integration.md` only if a concrete implementation example is needed.
- Load `ref-cli-reference.md` only when command details are missing or you need exact flag behavior.

## Interaction style

- **Suggest, don't ask open-ended questions.** Instead of "What do you want to do?", say "Authors doesn't have a flow yet. Want me to connect it to your Notion workspace?"
- **Show choices from real data.** List integrations/collections by name and ID from CLI output. When discovering source collections, show them as a numbered pick list.
- **One step at a time.** Execute the current step, show the result, then suggest the next step.
- **Keep context tight.** Load only the reference file needed for the current mode and step. Request `--full` only when the compact resource summary is insufficient.
- **Capture IDs.** After every create command, parse the returned ID and use it in subsequent commands automatically.
- **Confirm before mutating.** Show the exact command before running creates/updates/deletes. One-line explanation of what it does.
- **Finish the app integration when the path is obvious.** If a live collection exists and the repo is still rendering placeholder content, swap it to a real Contfu query instead of stopping after package install or `.env` setup.
- **Never read secrets into context.** Don't cat config files or echo env vars containing keys.
- **Never hardcode secrets in code.** Guide users to `.env` files.
