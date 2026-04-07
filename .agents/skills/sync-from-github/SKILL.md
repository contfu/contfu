---
name: sync-from-github
description: Merge changes FROM the GitHub mirror (contfu/contfu) back into the Forgejo repo. Creates a PR branch with a merge commit preserving GitHub authorship. Use when PRs were merged on GitHub that need to come back to Forgejo.
---

# Sync from GitHub Mirror

Merge changes from the GitHub mirror back into the Forgejo repo, preserving commit authorship.

**IMPORTANT:** Forgejo is the source of truth. This skill is for pulling back changes that were made directly on the GitHub mirror (e.g. CI fixes that touched shared code, external contributions).

## Workflow

### 1. Preview incoming changes

```bash
./scripts/sync-from-github.sh --preview
```

### 2. Run the merge

```bash
./scripts/sync-from-github.sh
```

This creates a branch `sync/from-github-<date>` with a merge commit from `github/main`.

### 3. Handle conflicts

If there are conflicts (common on first sync or when GitHub-only files diverge):

- Accept Forgejo's version for files that intentionally differ (root `package.json`, Forgejo-specific configs)
- Accept GitHub's version for shared package changes
- Run `bun install` if any `package.json` was modified

### 4. Verify

```bash
bun run test
```

### 5. Create PR

Push the branch and create a Forgejo PR for review. **Do NOT merge without user approval.**

## Notes

- The first merge uses `--allow-unrelated-histories` to establish a shared ancestor
- Subsequent merges are normal git merges and much cleaner
- GitHub-only files (`.github/`, `README.md`, `LICENSE`) will appear in the first merge — resolve by keeping Forgejo's versions
