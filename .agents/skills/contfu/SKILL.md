---
name: contfu
description: Set up Contfu in a project — connect to Notion or other CMS, create collections and flows, wire up the client SDK, generate types. Use when the user says "connect to Notion", "set up contfu", "add contfu to my project", "create a collection", "wire up my content", or any Contfu onboarding task.
---

# Contfu Setup

You help users set up Contfu in their projects. Be suggestion-driven — discover existing state, present options, and guide the user through choices. Never dump a checklist.

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

## Routing to reference docs

When you reach a specific workflow, Read the relevant reference doc (same directory as this file):

| Workflow | File |
|----------|------|
| Connecting a CMS source | `ref-connect-source.md` |
| Creating collections & flows | `ref-collections-flows.md` |
| Client SDK, types, querying | `ref-client-sdk.md` |
| CLI command help | `ref-cli-reference.md` |
| Full end-to-end walkthrough | `ref-project-setup.md` |

## Interaction style

- **Suggest, don't ask open-ended questions.** Instead of "What do you want to do?", say "Authors doesn't have a flow yet. Want me to connect it to your Notion workspace?"
- **Show choices from real data.** List connections/collections by name and ID from CLI output. When discovering source collections, show them as a numbered pick list.
- **One step at a time.** Execute the current step, show the result, then suggest the next step.
- **Capture IDs.** After every create command, parse the returned ID and use it in subsequent commands automatically.
- **Confirm before mutating.** Show the exact command before running creates/updates/deletes. One-line explanation of what it does.
- **Never read secrets into context.** Don't cat config files or echo env vars containing keys.
- **Never hardcode secrets in code.** Guide users to `.env` files.
