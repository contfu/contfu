---
name: issues
description: Turn short descriptions into structured, agent-ready Forgejo issues on code.sven-rogge.com. Use when you want to plan work without implementing it and need issue context, relevant files, and acceptance criteria captured for later execution.
---

# Forgejo Issues

Create structured issues on the Forgejo instance at `https://code.sven-rogge.com` for `contfu/contfu`.

## Workflow

1. Accept one or more short issue descriptions from the user.
2. Make sure the request is understood before exploring or drafting. If the scope, user impact, constraints, or desired end state are unclear, ask the user to clarify in one concise round.
3. Explore the codebase for relevant files and existing patterns when local context is needed.
4. Draft each issue using the template below.
5. Present the full draft or drafts to the user and wait for approval before creating anything on Forgejo. If the user requests edits, revise the draft and present it again.
6. Create the approved issue with `tea issue create`.
7. Load the `forgejo` skill and use it to mark the new issue as `ready`.

## Clarification Guidelines

Do not explore or draft until you can answer these questions:

| Question                                                                  | Why it matters                                            |
| ------------------------------------------------------------------------- | --------------------------------------------------------- |
| What is the concrete problem or missing capability?                       | Vague issues lead to scope creep or wrong implementations |
| Who is affected (end user, developer, CI, etc.)?                          | Shapes acceptance criteria and priority                   |
| What should the end state look like?                                      | Without this, "done" is undefined                         |
| Are there constraints (backwards compat, performance, specific approach)? | An implementer needs to know boundaries                   |
| Is this a bug, enhancement, or documentation issue?                       | Determines the label and framing                          |

If the user request is vague or plausibly points to multiple outcomes, ask for clarification before proceeding.

## Issue Body Template

Every issue should follow this structure:

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

## Labels

Assign one type label: `enhancement`, `bug`, or `documentation`.

Use status labels to track lifecycle:

| Label         | Meaning                   |
| ------------- | ------------------------- |
| `ready`       | Ready to be picked up     |
| `in-progress` | Currently being worked on |
| `done`        | Completed                 |

Check existing labels with:

```bash
tea labels list --login forgejo --repo contfu/contfu
```

## Commands

Create the issue:

```bash
tea issue create --login forgejo --repo contfu/contfu \
  --title "<title>" \
  --labels "<label>" \
  --description "$(cat <<'EOF'
<body>
EOF
)"
```

Set the new issue status to `ready` using the `forgejo` skill.

## Rules

- Auto-label each issue as `enhancement`, `bug`, or `documentation`.
- Add the `ready` label after creation.
- Never implement code in this skill.
- Always present drafts for approval before creating them on Forgejo.
- Keep titles concise and imperative, for example `Add webhook retry logic`.
- Explore only as much as needed to make the issue actionable.
