# GitHub Mirror

The public GitHub repo [`contfu/contfu`](https://github.com/contfu/contfu) is a mirror of the public packages from this Forgejo repository. **Forgejo is the source of truth** for all development.

## Setup

Add the GitHub remote (one-time):

```bash
git remote add github git@github.com:contfu/contfu.git
```

## Syncing Forgejo → GitHub

### Using the sync script

```bash
./scripts/sync-github.sh          # sync to .worktrees/github-mirror
./scripts/sync-github.sh --diff   # sync and show full diff
./scripts/sync-github.sh --clean  # remove the worktree
```

The script:
1. Fetches the latest `github/main`
2. Creates a git worktree at `.worktrees/github-mirror`
3. Copies public packages and configs via rsync
4. Shows a diff summary

### After syncing

1. Review the changes in `.worktrees/github-mirror`
2. Commit with a descriptive message
3. Push to GitHub

```bash
cd .worktrees/github-mirror
git commit -m "sync: description of changes"
git push github HEAD:main
```

### Using the Claude Code skill

Run `/sync-github` to have Claude automate the sync, diff analysis, and commit message crafting.

## Syncing GitHub → Forgejo (community contributions)

When a community PR is merged on GitHub:

```bash
git fetch github
git log github/main --oneline    # find the new commits
git cherry-pick <commit-hash>    # preserves author attribution
```

Create a Forgejo PR with the cherry-picked commits as usual.

## What's included in the mirror

See `github-mirror.conf` for the full list:

- `packages/core` — core types and utilities
- `packages/cli` — CLI tool
- `packages/client/*` — client SDK packages
- `packages/service/core` — service API types
- `docs/` — public documentation (excludes `docs/private/`)
- Shared configs (tsconfig, oxlint, etc.)

## What's excluded

- `packages/service/backend`, `packages/service/sources`, `packages/service/sync`, `packages/service/app` — private service implementation
- `packages/client/app` — private client application
- `demos/` — demo applications
- `tests/` — E2E tests (depend on private packages)
- Docker files for private services
- `docs/private/` — internal documentation

## GitHub-only files

These are maintained directly in the GitHub repo and are NOT overwritten by the sync:

- Root `package.json` — workspace config for public packages only
- `bun.lock` — regenerated after each sync
- `.github/workflows/` — npm publishing and Docker image workflows
- `Dockerfile.client` — client app Docker build
- `README.md`, `CONTRIBUTING.md`, `LICENSE`

## Rules

- **Forgejo is the source of truth.** All development happens here.
- **Never push to GitHub without reviewing the diff first.**
- **Agents must never commit to GitHub unless explicitly told to.**
- Community contributions flow back via cherry-pick to preserve authorship.
