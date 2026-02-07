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
- **Clients** - Applications consuming content via SSE (Server-Sent Events)

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

### Database Testing Pattern

- **Use real database:** Tests use the in-memory SQLite database by default (`:memory:`), not mocks
- **Truncate before each test:** Import `truncateAllTables` from `test/setup.ts` and call in `beforeEach()`
- **Single source of truth:** Keep table truncation logic in `test/setup.ts` so it stays in sync with schema changes
- **Respect FK order:** Create parent records before child records in tests
- **Skip if mocked:** Use `describe.skipIf(isDbMocked)` for tests that need real db when running from monorepo root

### E2E Tests

E2E tests are in `/tests/e2e/`. They use Playwright and require:

- Strapi demo server (`demos/strapi-demo`)
- Service app (`packages/service/app`)

Run with:

```bash
cd tests
E2E_FULL_FLOW=true bun test:e2e
```

**E2E Testing Best Practices:**

- **Write tests from user perspective** - Wait for UI changes, not network responses. Users see the UI, not the network tab.
- **Don't intercept responses** - With enhanced forms (progressive enhancement), forms use fetch instead of navigation. Wait for visible UI changes after actions.
- **Use locators over response parsing** - Instead of `page.waitForResponse()` + parsing, use `locator.waitFor()` to wait for elements to appear.

```ts
// ✅ Correct - wait for UI
await button.click();
await page.locator("text=Success").waitFor({ state: "visible" });

// ❌ Wrong - intercept response
const response = await page.waitForResponse((r) => r.url().includes("/api"));
const data = await response.json();
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
- `@contfu/client` (`packages/client/client`) - SSE client for consuming synced data
- `@contfu/client-core` (`packages/client/core`) - Client-side database utilities (Kysely)
- `@contfu/bun-file-store` (`packages/client/bun-file-store`) - File storage utilities for Bun
- `@contfu/media-optimizer` (`packages/client/media-optimizer`) - Media optimization utilities using Sharp

**Backend Services** (`packages/service/`):

- `@contfu/svc-sync` (`packages/service/sync`) - Sync service for real-time content streaming via RxJS; includes Notion adapter
- `@contfu/svc-app` (`packages/service/app`) - Qwik City web application with Bun server adapter

### Key Technologies

- **Runtime**: Bun
- **Database**: SQLite/libSQL with Drizzle ORM (server), Kysely (client)
- **Sync Service**: SSE (Server-Sent Events), RxJS for reactive streams
- **App Service**: SvelteKit, Vite, TailwindCSS
- **Auth**: Arctic (OAuth), Argon2 (passwords)

### Data Flow

1. CMS sources (e.g., Notion) are polled/synced via adapters in `packages/service/sync/src/sources/`
2. Items flow through the sync service which buffers and broadcasts via SSE
3. Clients connect with authentication keys, receive real-time item events
4. Events are sent as JSON over SSE with structure: `{ type, item: { collection, id, createdAt, changedAt, ref, props, content? } }`

### Database Schema

Database schemas are located in:

- `packages/service/app/src/db/schema.ts` - App service schema (users, etc.)
- `packages/service/sync/src/db/schema.ts` - Sync service schema
- `packages/client/app/src/core/db/schema.ts` - Client-side schema (pages, etc.)

Core entities include:

- `user` - Users with email/OAuth authentication
- `page` - Client-side pages with content and metadata
- Various service-specific tables for sources, collections, connections, etc.

### Database Query Guidelines

- **Minimal fetching:** Use lightweight select functions (e.g., `selectSource`) for existence checks; use aggregate variants (e.g., `selectSourceWithCollectionCount`) only when counts are displayed
- **Avoid N+1:** Batch related queries instead of looping
- **Filter aggregations:** Scope count queries to specific IDs, not all user data

### Docker Targets

The Dockerfile has three targets:

- `migrator` - Runs database migrations
- `sync` - Sync service (port 3000)
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

## ⚠️ Learnings & Process Improvements

**IMPORTANT: Update this section when you learn something that would help future work.**

This section captures lessons learned to prevent repeating mistakes and improve collaboration.

### Code Changes

- **Minimal changes only**: When updating dependencies or fixing issues, make the smallest possible change. Don't refactor or introduce new patterns unless explicitly asked.
- **Ask before large changes**: If you think a significant architectural change is needed, present a plan first. Don't implement large pattern changes without approval.
- **Forks often have identical APIs**: When migrating from a fork to the official package (e.g., `notion-client-web-fetch` → `@notionhq/client`), check if the API is identical. Often forks only change internals (like fetch implementation), so you may only need to change the import path.

### Notion Integration

- **Single client instance**: Use one shared `Client` instance, pass `auth` per request. Don't create new clients for each call.
- **Use SDK helpers**: The `@notionhq/client` SDK exports useful helpers like `iteratePaginatedAPI`, `isFullPage`, `isFullBlock`. Use them instead of reimplementing pagination.

### Testing

- **Run tests from package directory**: When packages have their own `bunfig.toml` with preload scripts, run `bun test` from inside the package directory (e.g., `cd packages/service/sync && bun test`), or use `bun run test` from root which runs `bun --filter '@contfu/*' test`.

## Vertical Slice Architecture

### Rules

1. **One function per file** - Each feature function gets its own file
2. **No re-exports** - App imports directly from `@contfu/svc-backend/...`
3. **Domain types** - Features return DTOs from `domain/types.ts`, not DB types
4. **No credential exposure** - Sensitive data never exposed to app layer

### Feature Structure

```
features/
  sources/
    createSource.ts      # export async function createSource(...)
    deleteSource.ts      # export async function deleteSource(...)
    getSource.ts         # export async function getSource(...)
    listSources.ts       # export async function listSources(...)
    ...
```

### Imports in App

```ts
// ✅ Correct - direct import
import { createSource } from "@contfu/svc-backend/features/sources/createSource";

// ❌ Wrong - re-export
import { createSource } from "$lib/server/sources";
```

### Domain Types

Types that are shared across features or exposed to consumers/clients belong in `@contfu/core`, not in feature files:

```ts
// ✅ Correct - domain types in core
// packages/core/src/incidents.ts
export const IncidentType = { SchemaIncompatible: 1, FilterInvalid: 2, SyncError: 3 } as const;

// ❌ Wrong - types defined in feature file
// features/incidents/createIncident.ts
export type IncidentType = "schema_incompatible" | "filter_invalid";
```

### Enums

Use **const objects** instead of TypeScript enums or string unions:

```ts
// ✅ Correct - const object with numeric values
export const IncidentType = {
  SchemaIncompatible: 1,
  FilterInvalid: 2,
  SyncError: 3,
} as const;
export type IncidentType = (typeof IncidentType)[keyof typeof IncidentType];

// ❌ Wrong - string union
export type IncidentType = "schema_incompatible" | "filter_invalid";
```

### SvelteKit Data Loading

**Don't use `+page.server.ts` for data loading** — use remote functions instead:

```ts
// ✅ Correct - remote function in +page.svelte
import { getCollection } from "$lib/server/features/collections/getCollection";
const collection = await getCollection(userId, collectionId);

// ❌ Wrong - +page.server.ts load function
export const load = async ({ params }) => { ... };
```

For mutations, use form actions with `<form method="POST">` instead of `+page.server.ts` actions.
