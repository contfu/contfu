---
name: pr
description: Create a pull request following the contfu workflow. Use when changes are complete and ready to PR.
---

# PR Workflow

Create a pull request following the project's commit & PR workflow.

## Workflow

1. **Run quality checks** — ensure all checks pass
2. **Squash if needed** — ensure exactly one commit (branch status is preprocessed above)
4. **Push branch** — create remote branch if needed
5. **Create PR** — open pull request with proper format
6. **Wait for CI** — watch checks, fix failures if any

## Pre-flight Checklist

Before creating a PR, run:

```bash
bun test && bun run fmt && bun run lint
```

All must pass.

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

### 3. Push branch

```bash
git push -u origin HEAD
```

Or force with lease if already exists:

```bash
git push --force-with-lease
```

### 4. Link GitHub issues

Before creating the PR, find matching issues to link. Search for issues related to the branch name or commit message keywords using the GitHub CLI:

```bash
gh issue list --search "<keywords from branch/commit>" --state open
```

Include `Closes #<issue-number>` lines in the PR body for each matching issue. This auto-closes them when the PR merges.

### 5. Create PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary

- <change 1>
- <change 2>

## Testing

- [ ] Tests pass locally
- [ ] Lint/format checks pass

Closes #<issue-number>
EOF
)"
```

### 6. Wait for CI checks

After creating the PR, wait for CI checks to complete and fix any failures. GitHub Actions needs a few seconds to register check runs on a new branch, so wait before polling:

```bash
sleep 5 && gh pr checks <pr-number> --watch
```

If checks fail, fix the issue, amend the commit, and force push:

```bash
git commit --amend
git push --force-with-lease
```

Then watch checks again until they pass.

## Commit Message Guidelines

- Use imperative mood (e.g., "Add feature" not "Added feature")
- Focus on the end-state change
- Do not include transient/debug/fixup steps
- Keep under 72 characters for subject line

## Rules

- **Never skip quality checks** — always run `bun test && bun run fmt && bun run lint`
- **Exactly one commit** — squash before creating PR
- **No force push to main** — never force push to main/master
- **Amend for new changes** — if PR is open, use `git commit --amend` + `git push --force-with-lease`

## Label Convention

Use appropriate labels:

- `bug` — bug fixes
- `enhancement` — new features
- `refactor` — code improvements
- `docs` — documentation changes
