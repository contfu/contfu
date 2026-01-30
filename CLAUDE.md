# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contfu ("content funnel") is a **proxy CMS** synchronization service that aggregates content from multiple upstream CMS platforms (Notion, Strapi, etc.) into a unified, locally-hosted database. It enables developers to consume content from various CMS platforms through a single, consistent API.

**For detailed product requirements, see [PRD.md](./PRD.md).**

### Deployment Modes

- **Self-hosted**: Single client connected to all collections with streaming, collections, and schema versioning
- **Server-hosted**: Multi-client support with media optimization, backups, and automation

### Core Concepts

- **Data Sources** - Connections to upstream CMSs (Notion, Strapi)
- **Collections** - Logical groupings of synchronized content
- **Items** - Individual content pieces with properties and content blocks
- **Clients** - Applications consuming content via WebSocket

## Common Commands

```bash
# Install dependencies
bun install

# Run all tests across workspaces
bun test

# Build all packages
bun run build

# Run a single package's tests
bun test --filter @contfu/svc-sync

# Run tests in a specific directory
cd packages/service/sync && bun test

# Run a specific test file
bun test packages/service/sync/src/server.spec.ts

# Development mode for all packages
bun run dev

# Format and lint (root level - uses oxfmt and oxlint)
bun run fmt
bun run lint

# Run sync service locally
cd packages/service/sync && bun run dev

# Run app service locally
cd packages/service/app && bun run dev

# Docker compose for full stack
docker-compose up
```

## Code Quality

**IMPORTANT: Always format and lint code and run tests after completing a task.**

After making any code changes, run the following commands:

```bash
# Format all code (root level - uses oxfmt)
bun run fmt

# Lint all code (root level - uses oxlint)
bun run lint

# Run all tests
bun run test
```

This ensures consistent code style and verifies that changes don't break existing functionality.

## Testing

### Development/Test Credentials

**IMPORTANT:** For local development and testing, use these pre-seeded credentials:

- **Email:** `test@test.com`
- **Password:** `test`

This user is created by `packages/service/app/src/lib/server/db/seed-dev.ts` specifically for tests and development.

**DO NOT register new users during e2e tests** - this triggers Polar customer creation which:

1. Requires a valid Polar API key
2. Creates real records that need manual cleanup

### E2E Tests

E2E tests are in `/tests/e2e/`. They use Playwright and require:

- Strapi demo server (`demos/strapi-demo`)
- Service app (`packages/service/app`)

Run with:

```bash
cd tests
E2E_FULL_FLOW=true bun test:e2e
```

**Strapi E2E testing patterns:**

- Tests interact with Strapi via **admin UI automation** (Playwright) for realistic user flows
- Use `strapiPage` fixture for admin panel, separate `page`/`consumerPage` for client app
- Article creation/editing goes through the full UI flow (Content Manager → Create → Fill form → Save → Publish)
- Strapi admin UI is complex - expect multiple navigation steps and wait states
- See `demos/strapi-demo/CLAUDE.md` for test credentials and API details

**Key fixtures in strapi-full-flow.spec.ts:**

- `strapiPage` - Authenticated Strapi admin browser context
- `syncServiceProcess` - Background sync service
- `STRAPI_URL`, `SERVICE_URL`, `CONSUMER_URL` - Service endpoints

## Before Creating a PR

**IMPORTANT: Follow these steps before pushing any changes:**

1. **Run tests, format, and lint:**

   ```bash
   bun test          # Ensure all tests pass (includes e2e tests)
   bun run fmt       # Format code
   bun run lint      # Lint code
   ```

> **Note:** E2E tests are not run on GitHub CI to save build time. Always run `bun test` locally before creating a PR - this includes e2e tests in the `zzz-e2e` directories.

2. **Squash into a single commit:**

   ```bash
   git rebase -i HEAD~N  # Where N is number of commits to squash
   # Mark all but first commit as 'squash' or 's'
   # Or use: git reset --soft HEAD~N && git commit
   ```

3. **Push and create PR**

## Architecture

### Monorepo Structure (Bun workspaces)

**Core Packages** (`packages/`):

- `@contfu/core` (`packages/core`) - Shared types and interfaces (items, collections, commands, events, sources, blocks)
- `@contfu/client` (`packages/client/client`) - WebSocket client for consuming synced data (msgpackr serialization)
- `@contfu/client-core` (`packages/client/core`) - Client-side database utilities (Kysely)
- `@contfu/bun-file-store` (`packages/client/bun-file-store`) - File storage utilities for Bun
- `@contfu/media-optimizer` (`packages/client/media-optimizer`) - Media optimization utilities using Sharp

**Backend Services** (`packages/service/`):

- `@contfu/svc-sync` (`packages/service/sync`) - Elysia WebSocket server for real-time sync; handles client connections, authentication, and item streaming via RxJS; includes Notion adapter
- `@contfu/svc-app` (`packages/service/app`) - Qwik City web application with Bun server adapter

### Key Technologies

- **Runtime**: Bun
- **Database**: SQLite/libSQL with Drizzle ORM (server), Kysely (client)
- **Sync Service**: Elysia framework, WebSocket, RxJS for reactive streams
- **App Service**: Qwik City, Vite, TailwindCSS
- **Serialization**: msgpackr for binary WebSocket messages
- **Auth**: Arctic (OAuth), Argon2 (passwords)

### Data Flow

1. CMS sources (e.g., Notion) are polled/synced via adapters in `packages/service/sync/src/sources/`
2. Items flow through the sync service which buffers and broadcasts via WebSocket
3. Clients connect with authentication keys, receive real-time item events
4. Events use a compact binary format: `[EventType, collection, id, createdAt, changedAt, [ref, props, content?]]`

### Database Schema

Database schemas are located in:

- `packages/service/app/src/db/schema.ts` - App service schema (users, etc.)
- `packages/service/sync/src/db/schema.ts` - Sync service schema
- `packages/client/app/src/core/db/schema.ts` - Client-side schema (pages, etc.)

Core entities include:

- `user` - Users with email/OAuth authentication
- `page` - Client-side pages with content and metadata
- Various service-specific tables for sources, collections, connections, etc.

### Docker Targets

The Dockerfile has three targets:

- `migrator` - Runs database migrations
- `sync` - Sync WebSocket service (port 3000)
- `app` - Qwik web application (port 3000)

## Skills

Development skills live in `skills/`. These provide guidance for AI coding assistants.

**⚠️ Keep skills in sync with the codebase:**

When modifying schemas, types, or core patterns in these areas, update the corresponding skill:

| Code Change                                | Update Skill              |
| ------------------------------------------ | ------------------------- |
| `packages/core/src/` types/interfaces      | `contfu-content-modeling` |
| Database schemas (`*/db/schema.ts`)        | `contfu-content-modeling` |
| Source adapters (`sync/src/sources/`)      | `contfu-source-adapter`   |
| UI components, design patterns             | `contfu-design`           |
| Dev workflow, commands, monorepo structure | `contfu-development`      |
