---
name: next
description: Pick the next issue to work on from the project board. Analyzes "Ready" issues for dependencies and conflicts with in-progress work, recommends the best candidate, and creates a branch.
---

# Next

Pick the best next issue to work on from the GitHub project board.

## Workflow

1. **Fetch** all items from the project board via `gh project item-list 1 --owner contfu --format json`
2. **Identify** issues with status "Ready"
3. **Analyze** each "Ready" issue for:
   - Dependencies on in-progress issues (read issue bodies for references like "depends on #X", "blocked by #X", or logical prerequisites)
   - Overlap with in-progress work (touching the same files or subsystems)
   - Complexity and self-containedness
4. **Recommend** the best candidate — prefer issues that:
   - Have no dependency on in-progress issues
   - Touch different files/areas than in-progress work (minimize merge conflicts)
   - Are self-contained and can be completed independently
5. **Confirm** — use `AskUserQuestion` to present the recommendation with reasoning and let the user pick (options: recommended issue, other "Ready" issues)
6. **Worktree** — use `EnterWorktree` to create an isolated worktree, then create a concise branch from `origin/main`:
   - `fix/<slug>` for bugs, `feat/<slug>` for enhancements, `docs/<slug>` for documentation
   - Slug: kebab-case, max 30 chars, derived from issue topic (not the full title)
7. **Enter plan mode** to analyze the chosen issue and design the implementation approach

## Commands

```bash
# Fetch project items
gh project item-list 1 --owner contfu --format json --limit 50

# Fetch issue details (for dependency analysis)
gh issue view <number> --json number,title,body,labels

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
