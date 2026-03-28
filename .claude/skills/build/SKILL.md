---
name: build
description: End-to-end from idea to PR — creates a structured Forgejo issue, then immediately implements it. Use when the user describes work they want both planned AND built in one go, e.g. "build X", "create and implement Y". Combines the issues and implement skills.
model: sonnet
---

# Build

Turn a description into a Forgejo issue, then implement it — idea to PR in one shot.

Instance: `https://code.sven-rogge.com` | Repo: `contfu/contfu`

## Workflow

### Phase 1 — Issue creation (issues skill)

1. **Understand** the user's description. Make sure you know _what_ needs to change, _why_, and _what the end state looks like_. Use `AskUserQuestion` if anything is unclear — batch related questions into one call.
2. **Explore** the codebase for relevant files and patterns (skip if the user provides sufficient context).
3. **Scope check** — if the work is too large for a single PR, break it into multiple issues. Present all of them for approval, but only the first will be implemented in this session.
4. **Draft** each issue in the structured format (see "Issue body template" below).
5. **Approve** — use `EnterPlanMode` to present the draft(s). Wait for the user to approve or request edits. On edits, revise and re-enter plan mode.
6. **Create** on Forgejo via `tea issue create` after approval.
7. **Label** — add type label (`enhancement`, `bug`, or `documentation`) and set status to `ready`.

### Phase 2 — Implementation (implement skill)

After the issue is created, immediately implement the first (or only) issue:

1. **Worktree** — use `EnterWorktree`, create a branch from `origin/main`:
   - `fix/<slug>` for bugs, `feat/<slug>` for enhancements, `docs/<slug>` for documentation
2. **Update status** — mark the issue as `in-progress`
3. **Implement** — follow the issue's relevant files and suggested approach. No further user interaction needed — plan approval already happened in Phase 1.
4. **Review** your changes for bugs, security, and quality. Ensure appropriate test coverage.
5. **Check locally** — run `bun check` and make sure it passes.
6. **E2E verification** — if your changes touch the service app (backend routes, UI pages, webhooks, sync), run the relevant E2E tests via Docker:
   ```bash
   bun run test:e2e:local -- tests/e2e/your-test.e2e.ts  # targeted run
   bun run test:e2e:local                                  # full suite
   ```
   Write new E2E tests when adding user-facing features or API endpoints. See the `e2e-testing` skill for patterns.
7. **PR** — use the `pr` skill to create the PR.

## Issue Body Template

```markdown
## Context

[Why this matters, what problem it solves]

## Relevant files

- `path/to/file.ts` — role description

## Current behavior

[What happens now, if applicable]

## Expected behavior

[What should happen after implementation]

## Acceptance criteria

- [ ] Concrete, testable criterion

## Suggested approach

[Which files to modify, patterns to follow, gotchas]
```

## Rules

- **Understand first** — never explore or draft until you fully understand the issue. When in doubt, ask.
- **One approval checkpoint** — plan mode during issue drafting is the only user checkpoint. After that, implement autonomously through to a passing PR.
- **Multiple issues** — if the work splits into multiple issues, create all of them but only implement the first. Tell the user which issues remain.
- **Never skip the issue** — always create the Forgejo issue before implementing, even if the task seems simple. The issue is the record of work.
- **Minimal changes only** — don't refactor beyond what the issue requires.
- **Single commit** per PR with `closes #N`.
- **Follow existing patterns** found in the codebase.

## Creating Issues

```bash
tea issue create --login forgejo --repo contfu/contfu \
  --title "<title>" \
  --labels "<label>" \
  --description "$(cat <<'EOF'
<body>
EOF
)"
```

After creation, set status to ready:

```bash
.claude/skills/forgejo/scripts/forgejo-label set-status <number> ready
```

## Label Management

```bash
.claude/skills/forgejo/scripts/forgejo-label set-status <number> in-progress
.claude/skills/forgejo/scripts/forgejo-label set-status <number> done
.claude/skills/forgejo/scripts/forgejo-label add <number> <label>
.claude/skills/forgejo/scripts/forgejo-label remove <number> <label>
```

## Commit Message Format

```
<type>: <concise description>

closes #<number>
```

Where type matches the branch prefix: `feat`, `fix`, or `docs`.
