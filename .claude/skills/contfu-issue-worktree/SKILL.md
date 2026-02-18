---
name: contfu-issue-worktree
description: Create a git worktree for a GitHub issue, create a branch, and enter plan mode with the issue content. Use when the user wants to start working on a specific issue.
---

# Contfu Issue Worktree

Create a worktree for a GitHub issue and enter plan mode.

## Workflow

1. **Accept** a GitHub issue number or URL from the user
2. **Fetch** the issue details via `gh issue view`
3. **Create** a worktree with branch `fix/issue-<number>-<slug>` in `.worktree/<issue-number>-<slug>`
4. **Switch** to the new worktree
5. **Enter plan mode** — analyze the issue and present a plan

## Commands

```bash
# Fetch issue details
gh issue view <issue-number> --json number,title,body,url,labels

# Create worktree with branch
git worktree add --force -b fix/issue-<number>-<slug> .worktree/<issue-number>-<slug>

# Switch to worktree
cd .worktree/<issue-number>-<slug>
```

## Plan Mode

After creating the worktree, analyze the issue and present:

1. **Understanding** — restate the problem in your own words
2. **Relevant files** — search codebase for related code
3. **Suggested approach** — how to tackle the issue
4. **Questions** — clarify any ambiguities before implementing

## Rules

- **Always verify** the issue exists before creating worktree
- **Branch naming** — use `fix/issue-<number>-<slug>` or `feat/issue-<number>-<slug>` depending on labels
- **Slug** — derive from issue title (kebab-case, max 30 chars)
- **Never implement** in plan mode — present the plan first for user approval
