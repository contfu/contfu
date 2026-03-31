---
name: issues
description: Turn short descriptions into structured, agent-ready Forgejo issues on code.sven-rogge.com. Use when you want to plan work without implementing it — captures context, relevant files, and acceptance criteria so any agent can pick up the issue later.
model: haiku
---

# Forgejo Issues

Create structured issues on the Forgejo instance at `https://code.sven-rogge.com` (repo: `contfu/contfu`) from short descriptions.

## Workflow

1. **Accept** one or more short issue descriptions from the user
2. **Understand** — before doing anything else, make sure you fully understand the issue. Ask yourself: do I know _what_ needs to change, _why_ it needs to change, and _what the end state looks like_? If any of these are unclear, use `AskUserQuestion` to resolve them. See "Clarification guidelines" below.
3. **Explore** the codebase for relevant files and patterns (skip if the user provides sufficient context)
4. **Draft** each issue in the structured format below
5. **Approve** — call `EnterPlanMode` and present the full draft(s) as the plan so the user can read them. Wait for the user to approve or request edits via `ExitPlanMode`. On edits, revise and re-enter plan mode.
6. **Create** on Forgejo via `tea issue create` only after the user approves and exits plan mode
7. **Label as ready** — after creation, mark the issue as ready

## Clarification guidelines

Do NOT explore or draft until you can confidently answer all of the following. If you can't, ask the user — batch related questions into a single `AskUserQuestion` call.

| Question                                                                  | Why it matters                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| What is the concrete problem or missing capability?                       | Vague issues lead to scope creep or wrong implementations |
| Who is affected (end user, developer, CI, etc.)?                          | Shapes acceptance criteria and priority                   |
| What should the end state look like?                                      | Without this, "done" is undefined                         |
| Are there constraints (backwards compat, performance, specific approach)? | An implementer needs to know boundaries                   |
| Is this a bug, enhancement, or documentation issue?                       | Determines the label and framing                          |

**When to ask vs. infer:** If the user's description is a clear, specific sentence (e.g. "add a retry button to the webhook panel"), you likely have enough. If it's vague (e.g. "fix the auth flow"), underspecified (e.g. "add caching"), or could mean multiple things, always ask.

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

## Labels

### Type labels

Auto-assigned on creation: `enhancement`, `bug`, or `documentation`.

### Status labels

Track issue lifecycle — mutually exclusive, managed via shared scripts:

| Label         | Meaning                   |
| ------------- | ------------------------- |
| `ready`       | Ready to be picked up     |
| `in-progress` | Currently being worked on |
| `done`        | Completed                 |

Check existing labels:

```bash
tea labels list --login forgejo --repo contfu/contfu
```

## Rules

- **Auto-label** each issue: `enhancement`, `bug`, or `documentation`
- **Add `ready` label** after creating the issue
- **Understand first** — never start exploring or drafting until you're confident you understand the issue. When in doubt, ask.
- **Skip exploration** when the user provides file paths and sufficient context
- **Never implement** — this skill creates issues only, never writes code
- **Always get approval** — use `EnterPlanMode` to present drafts so the user can read them; only create after they approve via `ExitPlanMode`
- **Title format** — concise, imperative mood (e.g. "Add webhook retry logic")
- **Use `AskUserQuestion`** for clarifying ambiguities only — NOT for presenting drafts (use plan mode for that)
- When exploring, use the Agent tool with `subagent_type=Explore` to find relevant files efficiently

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

After creation, set the issue status to `ready`:

```bash
.claude/skills/forgejo/scripts/forgejo-label set-status <number> ready
```
