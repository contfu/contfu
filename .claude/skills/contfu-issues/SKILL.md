---
name: contfu-issues
description: Turn short descriptions into structured, agent-ready GitHub issues. Use when you want to plan work without implementing it — captures context, relevant files, and acceptance criteria so any agent can pick up the issue later.
---

# Contfu Issues

Create structured GitHub issues from short descriptions.

## Workflow

1. **Accept** one or more short issue descriptions from the user
2. **Clarify** if the description is ambiguous — use `AskUserQuestion` to resolve unknowns before exploring
3. **Explore** the codebase for relevant files and patterns (skip if the user provides sufficient context)
4. **Draft** each issue in the structured format below
5. **Approve** — use `AskUserQuestion` to present the draft and ask for approval (options: "Create", "Edit"). On "Edit", ask what to change, revise, and re-approve.
6. **Create** on GitHub via `gh issue create`

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
- **Always get approval** — use `AskUserQuestion` to present the draft and get explicit approval before creating
- **Title format** — concise, imperative mood (e.g. "Add webhook retry logic")
- **Use `AskUserQuestion`** for all user interactions — clarifying ambiguities, presenting drafts for approval, and asking for edits
- When exploring, use the Agent tool with `subagent_type=Explore` to find relevant files efficiently

## Creating Issues

```bash
gh issue create --title "<title>" --label "<label>" --body "$(cat <<'EOF'
<body>
EOF
)"
```
