---
name: implement
description: Pick up a Forgejo issue and implement it end-to-end. Use when you're ready to execute on a planned issue — reads the issue, creates a branch, plans the approach, implements with minimal changes, runs quality checks, and opens a PR on Forgejo. Only stops for plan approval — then implements through to a passing PR without further interaction.
---

# Implement

Implement a Forgejo issue from start to PR.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Issue Details

!`tea issue view $0 --login forgejo --repo contfu/contfu`

## Workflow

1. **Read the issue** — review the issue details above. If more context is needed, fetch linked issues.
2. **Worktree** — use `EnterWorktree` to create an isolated worktree, then create a concise branch from `origin/main`:
   - `fix/<slug>` for bugs, `feat/<slug>` for enhancements, `docs/<slug>` for documentation
   - Slug: kebab-case, max 30 chars, derived from issue topic (not the full title)
3. **Update status** — move the issue to in-progress:
   ```bash
   .claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
   ```
4. **Enter plan mode** to analyze the chosen issue and design the implementation approach. This is the user's checkpoint — they approve the plan before implementation begins.
5. **Implement** — after the user approves the plan, implement it, without further user interaction.
6. **Review** your changes for bugs, security and quality. Also make sure that test coverage is appropriate.
7. **Check locally** - run `bun check` (format, build, lint, typecheck, unit tests) and make sure that it passes.
8. **PR** - use the `pr` skill to create the PR.

## Reflection Phase

After CI checks pass on the PR, reflect on the implementation:

1. **Identify blockers** — what was hard, what took multiple iterations, what assumptions were wrong?
2. **Extract learnings** — are there gotchas that future agents should know? Save them to memory if broadly applicable.
3. **Suggest improvements** — could a skill be extended, a test helper added, or a pattern documented to prevent similar friction next time?

Present findings to the user via `AskUserQuestion`. Propose concrete changes (skill updates, new helpers, documentation). If the user approves, amend them into the PR commit before merge.

This phase turns debugging pain into institutional knowledge — the same mistake should never cost multiple CI iterations again.

## Rules

- **Don't ask for confirmation** unless there's genuine ambiguity — plan approval is the only checkpoint
- **Always read the issue first** — the "Relevant files" and "Suggested approach" sections are your starting point
- **Follow existing patterns** found in the codebase
- **Minimal changes only** — don't refactor beyond what the issue requires
- **Run quality checks** before committing: `bun test && bun run fmt && bun run lint`
- **Single commit** — squash all work into one descriptive commit with `closes #N`
- **Always use `EnterWorktree`** — work in an isolated worktree to avoid interfering with the main checkout
- **Branch from `origin/main`** — always start fresh from the remote main branch
- **Implement end-to-end** — after plan approval, implement, verify, and open a PR without further user interaction
- **Reflect after CI passes** — run the reflection phase to capture learnings and suggest skill/doc improvements
- **Update labels** — move from `ready` to `in-progress` when starting work

## Commit Message Format

```
<type>: <concise description>

closes #<number>
```

Where type matches the branch prefix: `feat`, `fix`, or `docs`.

## Label Management

Use the shared scripts to manage issue status:

```bash
# Set status (removes other status labels automatically)
.claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
.claude/skills/forgejo/scripts/forgejo-label set-status <number> done

# Add/remove individual labels
.claude/skills/forgejo/scripts/forgejo-label add <number> <label>
.claude/skills/forgejo/scripts/forgejo-label remove <number> <label>
```
