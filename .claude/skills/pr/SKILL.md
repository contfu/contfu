---
name: pr
description: Create a pull request following the contfu workflow. Use when changes are complete and ready to PR.
---

# PR Workflow

Create a pull request following the project's commit & PR workflow.

## Workflow

1. **Run quality checks** — ensure all checks pass
2. **Run code review** — invoke `/review` to catch bugs and security issues before the PR
3. **Check branch status** — verify current branch and changes
4. **Squash if needed** — ensure exactly one commit
5. **Push branch** — create remote branch if needed
6. **Create PR** — open pull request with proper format
7. **Wait for CI** — watch checks, fix failures if any

## Pre-flight Checklist

Before creating a PR, run:

```bash
bun test && bun run fmt && bun run lint
```

All must pass.

## Steps

### 1. Run code review

Invoke the review skill to analyze changes, fix issues, and produce `.claude/review.md`:

```
/review
```

If the review made fixes, stage them before proceeding.

### 2. Check current state

```bash
git status
git log --oneline -5
git diff HEAD~1...HEAD
```

### 3. Squash commits (if multiple)

```bash
git rebase -i HEAD~N
```

Mark all but the first as `squash` or `fixup`.

### 4. Push branch

```bash
git push -u origin HEAD
```

Or force with lease if already exists:

```bash
git push --force-with-lease
```

### 5. Create PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary

- <change 1>
- <change 2>

## Testing

- [ ] Tests pass locally
- [ ] Lint/format checks pass
EOF
)"
```

### 6. Wait for CI checks

After creating the PR, wait for CI checks to complete and fix any failures:

```bash
gh pr checks <pr-number> --watch
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
- **Never skip code review** — always run `/review` before creating or updating a PR
- **Exactly one commit** — squash before creating PR
- **No force push to main** — never force push to main/master
- **Amend for new changes** — if PR is open, use `git commit --amend` + `git push --force-with-lease`

## Label Convention

Use appropriate labels:

- `bug` — bug fixes
- `enhancement` — new features
- `refactor` — code improvements
- `docs` — documentation changes
