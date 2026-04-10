---
name: pr-comments
description: Address PR review comments from Forgejo. Use when the user says handle PR comments, address review feedback, fix PR comments, or gives a PR number with review context.
argument-hint: <pr_number>
---

# PR Comments

Address unresolved review comments on a Forgejo PR.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Commands

Before handling comments, load the `forgejo` skill and use it to fetch unresolved review comments for `$0`.

Show the current branch:

```bash
git branch --show-current
```

## Workflow

1. Read each unresolved review comment and understand the requested change.
2. Decide whether each comment needs a code change or a discussion reply.
3. Implement actionable changes after reading the affected files.
4. Keep the `forgejo` skill loaded and use it to reply on the PR summarizing what changed.

5. Use the `forgejo` skill to resolve actionable conversations.

6. Leave discussion threads open when they still need reviewer input.
7. After all actionable comments are handled, run quality checks, amend the existing commit, and force-push with lease:

   ```bash
   bun run fmt && bun run lint
   git add -A && git commit --amend --no-edit
   git push --force-with-lease origin <branch>
   ```

## Rules

- Read affected files before editing.
- Keep changes tightly scoped to the review feedback.
- Batch the fixes into one amended commit.
- Reply to every comment.
- Resolve only comments that were actually addressed.
