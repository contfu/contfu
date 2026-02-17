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

## Before Creating a PR

1. **Run quality checks:**

   ```bash
   bun test && bun run fmt && bun run lint
   ```

2. **Squash commits:**
   ```bash
   git rebase -i HEAD~N  # Mark all but first as 'squash'
   ```

> E2E tests don't run on CI — always run `bun test` locally before PR.

## Code Quality Rules

- **Always** run `bun run fmt && bun run lint && bun test` after changes
- **Minimal changes only** — don't refactor unless asked
- **Ask before large changes** — present a plan first

## Skills

Development skills live in `skills/`. Update them when modifying related code.
