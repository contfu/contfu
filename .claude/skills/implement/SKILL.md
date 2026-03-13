---
name: implement
description: Pick up a GitHub issue and implement it end-to-end. Use when you're ready to execute on a planned issue — reads the issue, creates a branch, plans the approach, implements with minimal changes, runs quality checks, and opens a PR.
---

# Implement

Implement a GitHub issue from start to PR.

## Issue Details

!`gh issue view $0 --json number,title,body,labels`

## Workflow

1. **Read the issue** — review the issue details above. If more context is needed, fetch linked issues.
2. **Worktree** — use `EnterWorktree` to create an isolated worktree, then create a branch from `origin/main`:
   ```bash
   git fetch origin main
   git checkout -b <branch-name> origin/main
   ```
3. **Explore** — read the relevant files listed in the issue and understand current state.
4. **Plan** — enter plan mode and present the implementation approach for user approval.
5. **Implement** — execute the approved plan with minimal, focused changes.
6. **Verify** — run `bun test && bun run fmt && bun run lint`.
7. **Commit** — squash into a single descriptive commit referencing the issue (`closes #N`).
8. **Create PR** — `gh pr create` linking the issue, with summary and test plan.

## Branch Naming

| Issue label     | Branch prefix |
| --------------- | ------------- |
| `enhancement`   | `feat/`       |
| `bug`           | `fix/`        |
| `documentation` | `docs/`       |

Format: `<prefix><slug>` — kebab-case, max 30 chars, derived from issue topic (e.g. `feat/webhook-retries`).

## Rules

- **Always read the issue first** — the "Relevant files" and "Suggested approach" sections are your starting point
- **Enter plan mode before implementing** — present approach for user approval
- **Follow existing patterns** found in the codebase
- **Minimal changes only** — don't refactor beyond what the issue requires
- **Run quality checks** before committing: `bun test && bun run fmt && bun run lint`
- **Single commit** — squash all work into one descriptive commit with `closes #N`
- **Always use `EnterWorktree`** — work in an isolated worktree to avoid interfering with the main checkout
- **Branch from `origin/main`** — always start fresh from the remote main branch
- **Ask, don't guess** — if the issue lacks detail, ask clarifying questions rather than assuming

## Commit Message Format

```
<type>: <concise description>

closes #<number>
```

Where type matches the branch prefix: `feat`, `fix`, or `docs`.

## PR Creation

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Test plan
- [ ] <how to verify the changes>

closes #<number>
EOF
)"
```
