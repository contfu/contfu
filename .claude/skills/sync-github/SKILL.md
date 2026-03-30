---
name: sync-github
description: Sync public packages from Forgejo to the GitHub mirror (contfu/contfu). Runs the sync script, crafts a commit message, and stages changes for review. Does NOT push unless explicitly told to.
model: sonnet
---

# Sync to GitHub Mirror

Sync public code from the Forgejo repo to the GitHub mirror at `contfu/contfu`.

**IMPORTANT:** Forgejo is the source of truth. Never push to GitHub unless the user explicitly approves.

## Workflow

### 1. Run the sync script

```bash
# let's use direct bash calls where possible
! ./scripts/sync-github.sh
```

This creates/updates a worktree at `.worktrees/github-mirror` with the latest public packages synced from the Forgejo working tree.

### 2. Analyze changes

In the worktree, examine the diff:

```bash
! git -C .worktrees/github-mirror diff --cached --stat
! git -C .worktrees/github-mirror diff --cached
```

Cross-reference with recent Forgejo commits to understand what changed:

```bash
! git log --oneline -20
```

### 3. Craft commit message

Write a descriptive commit message summarizing the public-facing changes. Focus on:
- New features or API changes in public packages
- Bug fixes
- Breaking changes

Do NOT mention internal refactoring or private package changes.

### 4. Commit (but do NOT push)

```bash
cd .worktrees/github-mirror
git commit -m "<message>"
```

Present the commit to the user for review. **Stop here and wait for explicit approval before pushing.**

### 5. Push (only when approved)

Only if the user says to push:

```bash
cd .worktrees/github-mirror
git push github HEAD:main
```

Or to create a PR branch:

```bash
cd .worktrees/github-mirror
git checkout -b sync/<date>
git push github sync/<date>
```

## What gets synced

See `github-mirror.conf` for the full list. Summary:
- `packages/core`, `packages/cli`, `packages/client/*`, `packages/service/core`
- `docs/` (excluding `docs/private/`)
- Shared root configs (tsconfig, oxlint, etc.)

## What stays in GitHub only (not overwritten)

- Root `package.json` (different workspace config)
- `bun.lock` (regenerated separately)
- `.github/workflows/` (GitHub-specific CI)
- `Dockerfile.client`
- `README.md`, `LICENSE`
