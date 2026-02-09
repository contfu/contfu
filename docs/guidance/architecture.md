# Architecture

Load this when understanding code structure or making architectural decisions.

## Monorepo Structure (Bun workspaces)

**Core Packages** (`packages/`):
- `@contfu/core` - Shared types (items, collections, commands, events, sources, blocks)
- `@contfu/client` - SSE client for consuming synced data
- `@contfu/client-core` - Client-side database utilities (Kysely)
- `@contfu/bun-file-store` - File storage for Bun
- `@contfu/media-optimizer` - Media optimization (Sharp)

**Backend Services** (`packages/service/`):
- `@contfu/svc-sync` - Sync service with RxJS; includes Notion adapter
- `@contfu/svc-app` - SvelteKit web app with Bun adapter

## Key Technologies

- **Runtime**: Bun
- **Database**: SQLite/libSQL + Drizzle ORM (server), Kysely (client)
- **Sync**: SSE (Server-Sent Events), RxJS
- **App**: SvelteKit, Vite, TailwindCSS
- **Auth**: Arctic (OAuth), Argon2 (passwords)

## Data Flow

1. CMS sources polled via adapters in `packages/service/sync/src/sources/`
2. Sync service buffers and broadcasts via SSE
3. Clients connect with auth keys, receive real-time events
4. Events: `{ type, item: { collection, id, createdAt, changedAt, ref, props, content? } }`

## Database Schemas

- `packages/service/app/src/db/schema.ts` - App schema
- `packages/service/sync/src/db/schema.ts` - Sync schema
- `packages/client/app/src/core/db/schema.ts` - Client schema

## Query Guidelines

- **Minimal fetching:** Use lightweight selects; aggregates only when counts displayed
- **Avoid N+1:** Batch related queries
- **Filter aggregations:** Scope counts to specific IDs

## Docker Targets

- `migrator` - Runs database migrations
- `sync` - Sync service (port 3000)
- `app` - Web app (port 3000)
