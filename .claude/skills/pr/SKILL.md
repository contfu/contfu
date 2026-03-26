---
name: pr
description: Create a pull request following the contfu workflow. Use when changes are complete and ready to PR.
---

# PR Workflow

Create a pull request on Forgejo following the project's commit & PR workflow.

## Workflow

1. **Run tests** — ensure tests pass
2. **Squash if needed** — ensure exactly one commit
3. **Push branch** — create remote branch if needed
4. **Create PR** — open pull request with proper format
5. **Wait for CI** — watch checks, fix failures if any

## Pre-flight Checklist

Formatting, linting and testing are handled by the pre-commit git hook — do not run them manually.

## Current State

### Branch & Status

!`git branch --show-current && git status --short`

### Recent Commits

!`git log --oneline -5`

### Diff from last commit

!`git diff HEAD~1...HEAD --stat`

## Steps

### 1. Squash commits (if multiple)

```bash
git rebase -i HEAD~N
```

Mark all but the first as `squash` or `fixup`.

### 2. Push branch

```bash
git push -u origin HEAD
```

Or force with lease if already exists:

```bash
git push --force-with-lease
```

### 3. Link Forgejo issues

Before creating the PR, find matching issues to link. Search for issues related to the branch name or commit message keywords:

```bash
tea issues list --login forgejo --repo contfu/contfu --state open
```

Include `Closes #<issue-number>` lines in the PR description for each matching issue. This auto-closes them when the PR merges.

### 4. Create PR

```bash
tea pr create --login forgejo --repo contfu/contfu \
  --base main --head "$(git branch --show-current)" \
  --title "<title>" --description "$(cat <<'EOF'
## Summary

- <change 1>
- <change 2>

Closes #<issue-number>
EOF
)"
```

### 5. Wait for CI checks

After creating the PR, wait for CI checks to complete and fix any failures:

```bash
.claude/skills/forgejo/scripts/ci-wait
```

If checks fail, inspect logs and fix the issue:

```bash
.claude/skills/forgejo/scripts/ci-status
.claude/skills/forgejo/scripts/ci-logs <run_id> <job_index>
```

Then amend the commit and force push:

```bash
git commit --amend
git push --force-with-lease
```

Then wait for CI again until checks pass.

## Commit Message Guidelines

- Use imperative mood (e.g., "Add feature" not "Added feature")
- Focus on the end-state change
- Do not include transient/debug/fixup steps
- Keep under 72 characters for subject line

## Rules

- **Exactly one commit** — squash before creating PR
- **No force push to main** — never force push to main/master
- **Amend for new changes** — if PR is open, use `git commit --amend` + `git push --force-with-lease`

## Label Convention

Use appropriate labels via the forgejo-label script:

- `bug` (1) — bug fixes
- `enhancement` (2) — new features
- `documentation` (3) — documentation changes
