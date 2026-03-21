---
name: forgejo-next
description: Pick the next Forgejo issue to work on. Analyzes "ready" issues for dependencies and conflicts with in-progress work, recommends the best candidate, and creates a branch.
---

# Forgejo Next

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
5. **Confirm** — use `AskUserQuestion` to present the recommendation with reasoning and let the user pick (options: recommended issue, other "ready" issues)
6. **Worktree** — use `EnterWorktree` to create an isolated worktree, then create a concise branch from `origin/main`:
   - `fix/<slug>` for bugs, `feat/<slug>` for enhancements, `docs/<slug>` for documentation
   - Slug: kebab-case, max 30 chars, derived from issue topic (not the full title)
7. **Update status** — move the chosen issue to in-progress:
   ```bash
   .claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
   ```
8. **Enter plan mode** to analyze the chosen issue and design the implementation approach

## Commands

```bash
# Fetch issue details
tea issue view <number> --login forgejo --repo contfu/contfu

# Create branch in worktree (after EnterWorktree)
git fetch origin main
git checkout -b <branch-name> origin/main
```

## Rules

- **Always use `AskUserQuestion`** to confirm the issue selection before creating a branch
- **Never start work** on an issue that depends on an unfinished in-progress issue
- **Minimize interference** — prefer issues in different packages/subsystems than in-progress work
- **Always use `EnterWorktree`** — work in an isolated worktree to avoid interfering with the main checkout
- **Branch from `origin/main`** — always start fresh from the remote main branch
- **Never implement** in this skill — enter plan mode after branch creation
- **Update labels** — move the chosen issue from `ready` to `in-progress`
