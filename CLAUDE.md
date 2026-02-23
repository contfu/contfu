# CLAUDE.md

Guidance for AI coding assistants working with this repository.

## Project Overview

Contfu ("content funnel") is a **proxy CMS** that aggregates content from multiple upstream CMSs (Notion, Strapi) into a unified, locally-hosted database with real-time sync via SSE.

**For detailed requirements, see [PRD.md](./PRD.md).**

## Task-Specific Guidance

Load these **only when relevant** to keep context focused:

| Task                       | Load                              |
| -------------------------- | --------------------------------- |
| Writing/debugging tests    | `docs/guidance/testing.md`        |
| Understanding architecture | `docs/guidance/architecture.md`   |
| Creating features          | `docs/guidance/vertical-slice.md` |
| Avoiding past mistakes     | `docs/guidance/learnings.md`      |

## Common Commands

```bash
bun install              # Install dependencies
bun test                 # Run all tests (includes e2e)
bun run build            # Build all packages
bun run dev              # Development mode
bun run fmt              # Format code (oxfmt)
bun run lint             # Lint code (oxlint)

# Package-specific tests
cd packages/service/sync && bun test

# Database migrations (run from packages/service/backend)
cd packages/service/backend && bun run db:generate   # Generate migration from schema changes
```

## Commit & PR Workflow

1. **Pre-commit hook runs automatically:** formatting, linting, and unit tests run on every commit via `.githooks/pre-commit`. No manual step needed.

2. **Exactly one commit per PR branch at PR creation time.**
   - Intermediate commits are allowed while working.
   - Before creating or updating a PR, squash to one commit.
   - Use a clear final commit message focused on the end-state change.
   - Do not include transient/debug/fixup steps in the final commit message.

3. **If multiple commits exist, squash them before PR:**

   ```bash
   git rebase -i HEAD~N  # mark all but the first as squash/fixup
   ```

4. **If PR is already open and new changes are needed:**
   ```bash
   git add <files>
   git commit --amend
   git push --force-with-lease
   ```

> Root E2E tests run in CI. Ensure local validation before opening/updating a PR.

## Code Quality Rules

- **Pre-commit hook** handles formatting, linting, and tests automatically
- **Minimal changes only** — don't refactor unless asked
- **Ask before large changes** — present a plan first

## Skills

Development skills live in `skills/`. Update them when modifying related code.
