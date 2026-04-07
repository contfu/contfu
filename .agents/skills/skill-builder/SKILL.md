---
name: skill-builder
description: Use when creating new skills, improving existing skills, or auditing skill quality. Guides skill development for the canonical `.agents/skills` layout and portable, agent-agnostic skill content.
---

# Skill Builder

Create and maintain portable skills under `.agents/skills/<name>/`.

## Skill Standard

- Canonical skills live in `.agents/skills/<name>/`.
- Each skill directory contains `SKILL.md` and optional `scripts/`, `references/`, or other local support files.
- Keep canonical skills agent-agnostic. Do not embed harness-specific tool names, mode names, or runtime-specific compatibility-mirror paths.
- Keep frontmatter minimal. Prefer only:
  - `name`
  - `description`
  - `argument-hint` when arguments are expected

## Discovery Workflow

Before writing a new skill, interview the user until the workflow is concrete enough to implement.

Ask about:

1. Goal and scope
2. Trigger phrases and expected arguments
3. Step-by-step workflow
4. Required inputs, outputs, scripts, and references
5. Guardrails, failure modes, and boundaries

Summarize the result back to the user before writing files.

## Build Workflow

1. Choose a concise, lowercase, hyphenated skill name.
2. Create `.agents/skills/<name>/SKILL.md`.
3. Write a clear description that helps matching and direct invocation.
4. Keep the workflow concrete, ordered, and explicit.
5. Add support files only when they materially reduce `SKILL.md` size or improve reuse.
6. Reference local support files with paths relative to the skill root.
7. Update repo guidance docs if the new skill changes the standard workflow.

## Content Rules

- Prefer neutral language like "ask the user to choose" or "present the plan and wait for approval".
- Avoid runtime-specific instructions such as special question tools, plan-mode controls, or automatic command interpolation syntax.
- Use normal shell examples in fenced code blocks.
- Keep the skill focused on one repeatable job.

## Audit Checklist

- The skill lives in `.agents/skills/<name>/`.
- `SKILL.md` is the entrypoint.
- Frontmatter is minimal and portable.
- Local `scripts/` and `references/` paths are relative.
- No runtime-specific compatibility-mirror paths remain.
- No harness-specific tool names or mode semantics remain.
- The workflow is concrete enough that another agent can follow it without guessing.

See [reference.md](reference.md) for a compact canonical reference.
