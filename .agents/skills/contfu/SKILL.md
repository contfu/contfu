---
name: contfu
description: Set up or extend Contfu in a project — connect a CMS, create collections and flows, manage existing Contfu resources, wire up app queries, and adapt an existing integration. Use when the user says "connect to Notion", "set up contfu", "add contfu to my project", "create a collection", "wire up my content", "add another collection", "update a flow", or asks for Contfu integration work.
---

# Contfu Setup

You help users set up or adapt Contfu in their projects. Be suggestion-driven — discover existing state, present options, and guide the user through choices. Never dump a checklist.

Treat app integration as part of setup, not a follow-up idea. If the repo already contains mock content, placeholder arrays, or fixture-driven loaders for content that now exists in Contfu, replace that scaffolding with a real Contfu query when it is safe and the intent is clear.

This skill should be strong enough to complete a full app integration in one go, but also to handle narrower Contfu maintenance tasks without dragging in unnecessary context. Examples:

- Set up a brand-new app connection, collections, flows, generated types, and query wiring.
- Add another collection and flow to an existing app connection.
- Update or inspect existing connections, collections, or flows.
- Adapt an existing app integration when new Contfu-backed content needs to appear in the UI.

Use progressive disclosure. Start with the skill entrypoint and status discovery, then load only the next reference doc needed for the specific task. Do not pre-load every reference "just in case".

## Bootstrap

Run this automatically when the skill is invoked. Do not ask before running — just run and present results.

### Step 1 — Get full setup status

```bash
contfu status -f json
```

This returns JSON with `authenticated`, `connections`, `collections`, and `flows`. If the CLI is not found, try `bunx @contfu/cli setup` or `npx @contfu/cli setup`. If none work, tell the user to install: `npm install -g @contfu/cli`.

If `authenticated` is `false`, guide the user to run `contfu login` first. Do not proceed until authenticated.

### Step 2 — Present the situation

Parse the JSON and build a short, readable summary. Connection type labels are in the `typeLabel` field (e.g., "notion", "app", "strapi"). Key distinctions:

- **Source connections** (`typeLabel`: notion, strapi, contentful, web) — CMS data sources
- **App connections** (`typeLabel`: app) — the user's app consuming content

Present what exists and what's missing. Examples:

> **Your Contfu setup:**
> - Notion connection: "My Workspace" (id: 3)
> - 3 collections: Blog Posts, Authors, Projects
> - Blog Posts has a flow from Notion, but Authors and Projects are unwired
> - No app connection for this project yet
>
> Want me to wire up Authors and Projects, or set up an app connection first?

> **Your Contfu setup:**
> - No connections yet
>
> Let's connect your CMS first. Are you using Notion, or something else?

### Step 3 — Suggest and guide

Based on what's missing, suggest the next step. When the user picks a source connection to explore, discover what's available:

```bash
contfu discover <connection-id>
```

This returns the available source collections (Notion databases, Strapi content types) with `ref`, `displayName`, and `alreadyImported` fields. Present them as a pick list — the user selects which ones to import.

**IMPORTANT — source collection import required before flows:** `discover` only shows what's available; it does not import anything. Any collection with `alreadyImported: false` must be imported via the web UI before it can be used in a flow. Direct the user to `https://contfu.com/connections/<id>` and ask them to import the needed databases. Once imported, numeric source collection IDs become available via `contfu connections get <id>` — use those IDs (not the UUID refs) as `--source-id` when creating flows.

Route the work into one of these modes after discovery:

- **Full integration** — the app is not fully wired yet, and you should carry the work through connection, collections, flows, generated types, and code integration.
- **Resource maintenance** — the Contfu setup exists, and the task is to inspect, add, update, or delete a connection, collection, or flow.
- **App adaptation** — the Contfu resources already exist, and the task is to update the app code to consume them correctly.

### Step 4 — Wire the app code when an app already exists

Once the project has an app connection and relevant collections, inspect the repo and finish the integration:

1. Determine whether the app should query a remote Contfu server or a local Contfu database.
2. Generate TypeScript types from the CLI before writing query code.
3. Create a central typed Contfu query-builder module in the app's existing data-access layer.
4. Search for mock content, placeholder arrays, fixture-based loaders, or TODO scaffolding that should now come from Contfu.
5. Replace those placeholders with real queries when the mapping is clear.
6. Import that shared query builder wherever content needs to be fetched.
7. Remove the now-unused mock data and imports.

Rules for this step:

- Prefer `@contfu/client` when the app talks to a Contfu server over HTTP.
- Prefer `@contfu/contfu` when the app reads from a local Contfu database.
- Generate types with `contfu connections types <app-connection-id>` for the whole app connection. Use `contfu collections types <collection-id>` only when the integration is intentionally scoped to a single collection.
- Save generated types into the project and use the resulting `Collections` type as the generic on the central Contfu query builder.
- Put the Contfu query builder in one shared server/data module. Do not create separate client instances in each route, page, or component.
- Import that shared query builder into loaders, server modules, repositories, or other content-fetching code paths that need it.
- Reuse existing server-side loaders, data utilities, or repository modules. Do not scatter Contfu calls directly across presentational components unless the project already works that way.
- If the repo contains obvious sample content such as mock events, sample posts, or hardcoded content cards that correspond to a live Contfu collection, replace them with a real typed query instead of leaving both paths in place.
- Keep the query narrow and purposeful for the screen being built. Do not fetch every field "just in case".
- After wiring the live query, run the project's relevant checks so type mismatches from generated types are caught immediately.

### Step 5 — Manage existing Contfu resources when setup already exists

If the user is not asking for a full setup, work directly against the existing resources:

1. Inspect the current connections, collections, and flows from CLI output.
2. Identify the exact app connection, source connection, and target collection involved.
3. Make only the minimal resource changes needed for the task.
4. If the change affects app-visible content, continue into app adaptation and update the code integration too.

Typical examples:

- add one more source collection from an existing Notion connection
- create a new target collection on an existing app connection
- wire a new flow from an existing source collection into that target
- regenerate types and update the app's shared query builder so the new collection can be queried

When adding another collection to an existing integration, prefer this sequence:

1. discover available source collections
2. create or identify the target collection on the existing app connection
3. create the flow
4. regenerate connection-wide types
5. update the central `cq` module consumers where the new content is needed

## Routing to reference docs

When you reach a specific workflow, read only the relevant reference doc (same directory as this file). Do not bulk-load all references.

| Workflow | File |
|----------|------|
| Connecting a CMS source | `ref-connect-source.md` |
| Creating collections & flows | `ref-collections-flows.md` |
| Client SDK, types, querying | `ref-client-sdk.md` |
| Managing or extending an existing setup | `ref-maintenance.md` |
| CLI command help | `ref-cli-reference.md` |
| Full end-to-end walkthrough | `ref-project-setup.md` |

Reference loading rules:

- For full onboarding, start with `ref-project-setup.md`, then load `ref-connect-source.md`, `ref-collections-flows.md`, or `ref-client-sdk.md` only when you reach that step.
- For resource-only changes, prefer `ref-maintenance.md` and `ref-collections-flows.md`.
- For app-code changes, prefer `ref-client-sdk.md`.
- Load `ref-cli-reference.md` only when command details are missing or you need exact flag behavior.

## Interaction style

- **Suggest, don't ask open-ended questions.** Instead of "What do you want to do?", say "Authors doesn't have a flow yet. Want me to connect it to your Notion workspace?"
- **Show choices from real data.** List connections/collections by name and ID from CLI output. When discovering source collections, show them as a numbered pick list.
- **One step at a time.** Execute the current step, show the result, then suggest the next step.
- **Keep context tight.** Load only the reference file needed for the current mode and step.
- **Capture IDs.** After every create command, parse the returned ID and use it in subsequent commands automatically.
- **Confirm before mutating.** Show the exact command before running creates/updates/deletes. One-line explanation of what it does.
- **Finish the app integration when the path is obvious.** If a live collection exists and the repo is still rendering placeholder content, swap it to a real Contfu query instead of stopping after package install or `.env` setup.
- **Never read secrets into context.** Don't cat config files or echo env vars containing keys.
- **Never hardcode secrets in code.** Guide users to `.env` files.
