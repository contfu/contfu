---
name: implement
description: Pick up a Forgejo issue and implement it end-to-end. Use when you're ready to execute on a planned issue — reads the issue, creates a branch, plans the approach, implements with minimal changes, runs quality checks, and opens a PR on Forgejo. Only stops for plan approval — then implements through to a passing PR without further interaction.
---

# Forgejo Implement

Implement a Forgejo issue from start to PR.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Issue Details

!`tea issue view $0 --login forgejo --repo contfu/contfu --output json`

## Workflow

> **CRITICAL: Call `EnterWorktree` before touching any files. No exceptions.**

1. **Worktree** — call `EnterWorktree` immediately, then create a branch from `origin/main`:
   ```bash
   git fetch origin main
   git checkout -b <branch-name> origin/main
   ```
2. **Read the issue** — review the issue details above. If more context is needed, fetch linked issues.
3. **Update status** — move the issue to in-progress:
   ```bash
   .claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
   ```
4. **Explore** — read the relevant files listed in the issue and understand current state.
5. **Plan** — enter plan mode and present the implementation approach. This is the user's **single checkpoint** — they approve the plan before implementation begins.
6. **Implement and PR** — after the user approves the plan, implement, verify, commit, push, and open a PR without further user interaction. Use the `pr` skill to create the PR.

## Branch Naming

| Issue label     | Branch prefix |
| --------------- | ------------- |
| `enhancement`   | `feat/`       |
| `bug`           | `fix/`        |
| `documentation` | `docs/`       |

Format: `<prefix><slug>` — kebab-case, max 30 chars, derived from issue topic (e.g. `feat/webhook-retries`).

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
