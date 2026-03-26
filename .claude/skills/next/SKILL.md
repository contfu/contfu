---
name: next
description: Pick the next Forgejo issue, implement it end-to-end, and open a PR. Analyzes "ready" issues for dependencies and conflicts, picks the best candidate, implements, and creates a PR — only stopping to ask the user if there's genuine ambiguity.
---

# Next

Pick the best next issue to work on from the Forgejo issue tracker.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Current Issue State

### Ready Issues

!`tea issue list --login forgejo --repo contfu/contfu --labels ready --state open --output simple`

### In Progress Issues

!`tea issue list --login forgejo --repo contfu/contfu --labels in-progress --state open --output simple`

## Workflow

1. **Identify** issues with the `ready` label from the board state above
2. **Read details** — fetch each ready issue to understand scope:
   ```bash
   tea issue view <number> --login forgejo --repo contfu/contfu
   ```
3. **Analyze** each "ready" issue for:
   - Dependencies on in-progress issues (read issue bodies for references like "depends on #X", "blocked by #X", or logical prerequisites)
   - Overlap with in-progress work (touching the same files or subsystems)
   - Complexity and self-containedness
4. **Recommend** the best candidate — prefer issues that:
   - Have no dependency on in-progress issues
   - Touch different files/areas than in-progress work (minimize merge conflicts)
   - Are self-contained and can be completed independently
5. **Pick and go** — select the best candidate without asking the user. Only use `AskUserQuestion` if there's genuine ambiguity (e.g., two equally good candidates with real trade-offs). Use the `implement` skill for the issue implementation.

## Rules

- **Don't ask for confirmation** on issue selection unless there's genuine ambiguity
- **Never start work** on an issue that depends on an unfinished in-progress issue
- **Minimize interference** — prefer issues in different packages/subsystems than in-progress work
