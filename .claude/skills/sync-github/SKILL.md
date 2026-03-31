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

Write a commit message as if the changes were made directly in this repo — not a sync message. Use Conventional Commits style.

- Lead with the most significant change (feat/fix/chore/test/…)
- If multiple concerns, pick the dominant one for the subject; list others in the body
- Do NOT mention "sync", "Forgejo", "mirror", or any cross-repo language
- Do NOT mention internal refactoring or private package changes

Example subjects:
- `feat(service-core): add incident tracking types and WebAuthType constants`
- `fix(connect): simplify stream-client tests`
- `chore: update package dependencies`

### 4. Commit (but do NOT push)

```bash
cd .worktrees/github-mirror
git commit -m "<message>"
```

Present the commit to the user for review. **Stop here and wait for explicit approval before pushing.**

### 5. Create a PR (only when approved)

Only if the user says to push/sync:

```bash
cd .worktrees/github-mirror
git checkout -b <conventional-branch-name>
git push github <branch-name>
gh pr create --repo contfu/contfu \
  --title "<same as commit subject>" \
  --body "<description of changes>"
```

**Never push directly to main on GitHub.** Always go through a PR.

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
