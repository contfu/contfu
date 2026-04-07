---
name: next
description: Pick the next Forgejo issue, implement it end-to-end, and open a PR. Use when ready issues should be analyzed for dependencies and conflict risk so work can start immediately on the best candidate.
---

# Next

Pick the best next issue to work on from the Forgejo issue tracker.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Commands

List ready issues:

```bash
tea issue list --login forgejo --repo contfu/contfu --labels ready --state open --output simple
```

List in-progress issues:

```bash
tea issue list --login forgejo --repo contfu/contfu --labels in-progress --state open --output simple
```

Inspect an issue in detail:

```bash
tea issue view <number> --login forgejo --repo contfu/contfu
```

## Workflow

1. Gather the current `ready` and `in-progress` issue sets.
2. Read each ready issue in enough detail to understand scope and touched subsystems.
3. Prefer issues that:
   - do not depend on unfinished work
   - avoid overlap with in-progress changes
   - are self-contained and easy to deliver independently
4. Pick the best candidate without asking by default.
5. If two or more candidates are genuinely tied and the trade-offs matter, present the options and ask the user to choose.
6. Hand off to the `implement` skill for execution.

## Rules

- Never pick an issue that is blocked by unfinished work.
- Minimize merge-conflict risk by avoiding active subsystems when a comparable option exists.
- Only ask the user when the choice is materially ambiguous.
