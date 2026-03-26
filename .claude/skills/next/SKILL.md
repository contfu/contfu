---
name: next
description: Pick the next Forgejo issue, implement it end-to-end, and open a PR. Analyzes "ready" issues for dependencies and conflicts, picks the best candidate, implements, and creates a PR — only stopping to ask the user if there's genuine ambiguity.
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
5. **Pick and go** — select the best candidate without asking the user. Only use `AskUserQuestion` if there's genuine ambiguity (e.g., two equally good candidates with real trade-offs).
6. **Worktree** — use `EnterWorktree` to create an isolated worktree, then create a concise branch from `origin/main`:
   - `fix/<slug>` for bugs, `feat/<slug>` for enhancements, `docs/<slug>` for documentation
   - Slug: kebab-case, max 30 chars, derived from issue topic (not the full title)
7. **Update status** — move the chosen issue to in-progress:
   ```bash
   .claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
   ```
8. **Enter plan mode** to analyze the chosen issue and design the implementation approach. This is the user's checkpoint — they approve the plan before implementation begins.
9. **Implement and PR** — after the user approves the plan, implement, run tests/lint, commit, push, and open a PR without further user interaction. Use the `pr` skill to create the PR.

## Commands

```bash
# Fetch issue details
tea issue view <number> --login forgejo --repo contfu/contfu

# Create branch in worktree (after EnterWorktree)
git fetch origin main
git checkout -b <branch-name> origin/main
```

## Rules

- **Don't ask for confirmation** on issue selection unless there's genuine ambiguity
- **Never start work** on an issue that depends on an unfinished in-progress issue
- **Minimize interference** — prefer issues in different packages/subsystems than in-progress work
- **Always use `EnterWorktree`** — work in an isolated worktree to avoid interfering with the main checkout
- **Branch from `origin/main`** — always start fresh from the remote main branch
- **Implement end-to-end** — after plan approval, implement, verify, and open a PR without further user interaction
- **Update labels** — move the chosen issue from `ready` to `in-progress`
