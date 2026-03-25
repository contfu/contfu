---
name: pr-comments
description: Address PR review comments from Forgejo. Use when the user says "handle PR comments", "address review feedback", "fix PR comments", or gives a PR number with review context. Also use when user says "/pr-comments".
argument-hint: <pr_number>
---

# PR Comments

Address unresolved review comments on a Forgejo PR.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Unresolved Comments

!`.claude/skills/forgejo/scripts/pr-comments $0`

## Current Branch

!`git branch --show-current`

## Workflow

For each unresolved comment (where `review_id` is not null):

1. **Read the comment** — understand what the reviewer is asking for. The `path` and `diff_hunk` fields show exactly where the comment was left.
2. **Decide**: is this an actionable code change, or does it need discussion?
   - **Actionable** — implement the change, then reply and resolve.
   - **Needs discussion** — reply on the PR with a question or explanation (do not resolve).
3. **Implement** — make the requested change. Read the file first, then edit.
4. **Reply** — post a comment on the PR summarizing what was done:
   ```bash
   .claude/skills/forgejo/scripts/pr-reply <pr_number> "<reply body>"
   ```
5. **Resolve** — mark the conversation as resolved:
   ```bash
   .claude/skills/forgejo/scripts/pr-resolve <comment_id>
   ```
   Uses the Forgejo web session (`.forgejo-session`). If expired, run `forgejo-login` first.
6. **After all comments are addressed** — run quality checks, amend the commit, and force-push:
   ```bash
   bun run fmt && bun run lint
   git add -A && git commit --amend --no-edit
   git push --force-with-lease origin <branch>
   ```

## Scripts

| Script                    | Purpose                                                      |
| ------------------------- | ------------------------------------------------------------ |
| `pr-comments <pr>`        | Fetch unresolved review + issue comments as JSON             |
| `pr-reply <pr> <body>`    | Post a comment on the PR                                     |
| `pr-resolve <comment_id>` | Resolve a review comment conversation (requires web session) |

All scripts live in `.claude/skills/forgejo/scripts/`.

## Rules

- **Read before editing** — always read the file before making changes
- **Minimal changes** — only change what the reviewer asked for
- **One amend** — batch all comment fixes into a single amended commit
- **Always reply** — every comment gets a reply, either confirming the fix or asking a question
- **Resolve actionable comments** — resolve conversations after implementing the fix
- **Don't resolve discussions** — leave open if you replied with a question
- **Run quality checks** — `bun run fmt && bun run lint` before pushing
- **Force-push with lease** — use `--force-with-lease` to avoid overwriting others' work
