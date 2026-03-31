---
name: build
description: End-to-end from idea to PR — creates a structured Forgejo issue, then immediately implements it. Use when the user describes work they want both planned AND built in one go, e.g. "build X", "create and implement Y". Combines the issues and implement skills.
model: sonnet
---

# Build

Turn a description into a Forgejo issue, then implement it — idea to PR in one shot.

## Workflow

### Phase 1 — Issue creation

Use the `issues` skill to create the Forgejo issue. This is the user's approval checkpoint.

### Phase 2 — Implementation

After the issue is created, use the `implement` skill to implement it end-to-end.
No further user interaction needed — plan approval already happened in Phase 1.

## Rules

- **Multiple issues** — if the work splits into multiple issues, create all of them but only implement the first. Tell the user which issues remain.
- **Never skip the issue** — always create the Forgejo issue before implementing, even if the task seems simple. The issue is the record of work.
