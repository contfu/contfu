---
name: issues
description: Turn short descriptions into structured, agent-ready GitHub issues. Use when you want to plan work without implementing it — captures context, relevant files, and acceptance criteria so any agent can pick up the issue later.
model: sonnet
---

# Issues

Create structured GitHub issues from short descriptions.

## Workflow

1. **Accept** one or more short issue descriptions from the user
2. **Clarify** if the description is ambiguous — use `AskUserQuestion` to resolve unknowns before exploring
3. **Explore** the codebase for relevant files and patterns (skip if the user provides sufficient context)
4. **Draft** each issue in the structured format below
5. **Approve** — call `EnterPlanMode` and present the full draft(s) as the plan so the user can read them. Wait for the user to approve or request edits via `ExitPlanMode`. On edits, revise and re-enter plan mode.
6. **Create** on GitHub via `gh issue create` only after the user approves and exits plan mode

## Issue Body Template

Every issue must follow this structure:

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

## Modes

### Single mode

One description -> explore -> draft -> review -> create.

### Batch mode

Numbered list of descriptions -> explore shared context once -> draft all -> review all -> create all.

## Rules

- **Auto-label** each issue: `enhancement`, `bug`, or `documentation`
- **Skip exploration** when the user provides file paths and sufficient context
- **Never implement** — this skill creates issues only, never writes code
- **Always get approval** — use `EnterPlanMode` to present drafts so the user can read them; only create after they approve via `ExitPlanMode`
- **Title format** — concise, imperative mood (e.g. "Add webhook retry logic")
- **Use `AskUserQuestion`** for clarifying ambiguities only — NOT for presenting drafts (use plan mode for that)
- When exploring, use the Agent tool with `subagent_type=Explore` to find relevant files efficiently

## Creating Issues

```bash
gh issue create --title "<title>" --label "<label>" --body "$(cat <<'EOF'
<body>
EOF
)"
```
