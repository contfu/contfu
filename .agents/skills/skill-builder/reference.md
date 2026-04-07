# Skill Builder Reference

Compact reference for authoring canonical skills in this repo.

## Layout

Store project skills here:

```text
.agents/skills/<name>/
  SKILL.md
  scripts/
  references/
```

Expose those same directories to Claude through per-skill symlinks in `.claude/skills/`.

## Frontmatter

Prefer only these fields:

| Field | Use |
| --- | --- |
| `name` | Stable skill name, usually matching the directory |
| `description` | Short trigger-oriented summary |
| `argument-hint` | Optional hint for required arguments |

Keep model selection, tool restrictions, and preload behavior out of canonical skills. Put Claude-specific routing in `.claude/agents/*.md`.

## Writing Rules

- Keep skills agent-agnostic.
- Do not reference `.claude/skills/...` from canonical content.
- Do not use harness-specific instructions such as plan mode toggles or custom question tools.
- Use normal shell examples in fenced code blocks.
- Keep support-file references relative to the skill root.

## Good Patterns

- Small frontmatter, explicit workflow, concrete commands.
- Support files for large examples or reusable references.
- Neutral orchestration language:
  - "ask the user to choose"
  - "present the draft and wait for approval"
  - "create an isolated git worktree"

## Avoid

- Skill wrappers that exist only for one runtime.
- Hardcoded Claude-only or Codex-only control flow.
- Runtime-specific file paths in canonical skill content.

## Claude Layer

Claude-specific behavior belongs in `.claude/agents/*.md`.

Use agents there to:

- select a model
- preload one or more canonical skills with `skills:`
- add role-specific prompting

The canonical skill itself should stay portable.
