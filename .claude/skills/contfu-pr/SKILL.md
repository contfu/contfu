---
name: contfu-pr
description: Create a pull request following the contfu workflow. Use when changes are complete and ready to PR.
---

# Contfu PR Workflow

Create a pull request following the project's commit & PR workflow.

## Workflow

1. **Run quality checks** — ensure all checks pass
2. **Check branch status** — verify current branch and changes
3. **Squash if needed** — ensure exactly one commit
4. **Push branch** — create remote branch if needed
5. **Create PR** — open pull request with proper format

## Pre-flight Checklist

Before creating a PR, run:

```bash
bun test && bun run fmt && bun run lint
```

All must pass.

## Steps

### 1. Check current state

```bash
git status
git log --oneline -5
git diff HEAD~1...HEAD
```

### 2. Squash commits (if multiple)

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

### 4. Create PR

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
