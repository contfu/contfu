---
name: implement
description: Pick up a Forgejo issue and implement it end-to-end. Use when execution should start from an existing planned issue and carry through branch setup, implementation, verification, and PR creation.
argument-hint: <issue_number>
---

# Implement

Implement a Forgejo issue from issue read-through to PR.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Issue Details

Read the issue first:

```bash
tea issue view $0 --login forgejo --repo contfu/contfu
```

## Workflow

1. Read the issue carefully. Use the issue's relevant files and suggested approach as the starting point.
2. Create an isolated git worktree from `origin/main`, then create a concise branch:
   - `fix/<slug>` for bugs
   - `feat/<slug>` for enhancements
   - `docs/<slug>` for documentation
   - Keep the slug in kebab-case and under 30 characters.
3. Move the issue to `in-progress`:

   ```bash
   ../forgejo/scripts/forgejo-label set-status <number> in-progress
   ```

4. Analyze the implementation approach and present the plan to the user. Wait for approval before writing code.
5. Implement the issue with minimal changes and by following existing patterns.
6. Review the result for bugs, security issues, and missing test coverage.
7. Run local checks with `bun check`.
8. If the change touches the service app, backend routes, UI pages, sync, or webhooks, run the relevant E2E tests locally before pushing:

   ```bash
   bun run test:e2e:local -- tests/e2e/your-test.e2e.ts
   bun run test:e2e:local
   ```

9. Use the `pr` skill to open the PR and stay with it until CI is green or a concrete blocker is identified.

## Reflection Phase

After CI passes, reflect on the implementation:

1. Identify blockers, false assumptions, or expensive iterations.
2. Extract durable learnings that should be captured in repo docs or skills.
3. Present those findings to the user and, if approved, fold the improvements into the same PR commit before merge.

## Commit Message Format

```text
<type>: <concise description>

closes #<number>
```

Where `<type>` matches the branch prefix: `feat`, `fix`, or `docs`.

## Label Management

```bash
../forgejo/scripts/forgejo-label set-status <number> in-progress
../forgejo/scripts/forgejo-label set-status <number> done
../forgejo/scripts/forgejo-label add <number> <label>
../forgejo/scripts/forgejo-label remove <number> <label>
```

## Rules

- The plan approval is the only default checkpoint. Do not stop again unless you hit real ambiguity or a blocker.
- Always branch from `origin/main`.
- Always work in an isolated git worktree.
- Keep the change minimal and issue-scoped.
- Run appropriate local verification before pushing.
- Keep the PR to one commit and update that commit with `--amend` if follow-up fixes are required.
