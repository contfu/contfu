---
name: development
description: Develop and maintain the Contfu codebase. Use when working on Contfu internals, adding features, fixing bugs, running tests, understanding the monorepo structure, modifying database schemas, or contributing to any Contfu package.
model: sonnet
---

# Development

Internal development guide for the Contfu codebase.

## Quick Reference

```bash
bun install          # Install all dependencies
bun test             # Run all tests
bun run build        # Build all packages
bun run fmt          # Format code (oxfmt)
bun run lint         # Lint code (oxlint)
```

## Monorepo Structure

```
contfu/
├── packages/
│   ├── core/                    # @contfu/core — Shared types
│   ├── client/
│   │   ├── client/              # @contfu/client — WebSocket client
│   │   ├── core/                # @contfu/client-core — DB utilities
│   │   ├── bun-file-store/      # File storage for Bun
│   │   └── media-optimizer/     # Sharp-based optimization
│   └── service/
│       ├── sync/                # @contfu/svc-sync — WebSocket server
│       └── app/                 # @contfu/svc-app — SvelteKit web app
├── demos/
│   ├── consumer-app/            # Example client app
│   └── strapi-demo/             # Strapi test instance
└── scripts/                     # Build/deploy scripts
```

## Package Details

### @contfu/core

Shared types and interfaces. No runtime dependencies.

Key exports:

- `Item`, `PageProps`, `ContentBlock` — Content types
- `CollectionSchema` — Schema definitions
- `Command`, `Event` — WebSocket protocol
- `SourceType` — CMS source identifiers

### @contfu/svc-sync

Elysia WebSocket server for real-time sync.

```bash
cd packages/service/sync
bun run dev          # Start dev server
bun test             # Run tests
```

Key files:

- `src/server.ts` — Elysia app setup
- `src/sources/` — CMS adapters (Notion, Strapi)
- `src/db/schema.ts` — Drizzle schema

### @contfu/svc-app

SvelteKit web application.

```bash
cd packages/service/app
bun run dev          # Start dev server (Vite)
bun run build        # Production build
bun run check        # Type check
```

Key files:

- `src/routes/` — SvelteKit routes
- `src/lib/` — Shared components/utilities
- `src/db/schema.ts` — Drizzle schema

## Database Workflows

### Generate Migrations

```bash
# Sync service
cd packages/service/sync
bun run db:generate

# App service
cd packages/service/app
bun run db:generate
```

### Schema Locations

- Sync: `packages/service/sync/src/db/schema.ts`
- App: `packages/service/app/src/db/schema.ts`
- Client: `packages/client/core/src/db/schema.ts`

## Testing

```bash
# All tests
bun test

# Specific package
bun test --filter @contfu/svc-sync

# Specific file
bun test packages/service/sync/src/server.spec.ts

# Watch mode
bun test --watch
```

## Code Quality

**Always run before committing:**

```bash
bun run fmt          # Format with oxfmt
bun run lint         # Lint with oxlint
```

## PR Workflow

1. Run tests: `bun test`
2. Format: `bun run fmt`
3. Lint: `bun run lint`
4. Squash commits: `git rebase -i HEAD~N`
5. Push and create PR

## WebSocket Protocol

Messages use msgpackr serialization.

### Events (Server → Client)

```typescript
// Item event: [type, collection, id, createdAt, changedAt, [ref, props, content?]]
type ItemEvent = [
  EventType.Item,
  number, // collection
  Buffer, // id
  number, // createdAt
  number, // changedAt
  [Buffer, PageProps, ContentBlock[]?],
];
```

### Commands (Client → Server)

```typescript
type Command =
  | { type: "subscribe"; collections: number[] }
  | { type: "unsubscribe"; collections: number[] }
  | { type: "sync"; collection: number; since?: number };
```

## Docker Development

```bash
# Full stack
docker-compose up

# Individual services
docker-compose up sync
docker-compose up app
```

Dockerfile targets:

- `migrator` — Run migrations
- `sync` — Sync service (port 3000)
- `app` — Web app (port 3000)

## Adding a New Feature

1. Start with types in `@contfu/core` if shared
2. Implement in relevant service package
3. Add tests alongside implementation
4. Update CLAUDE.md if workflow changes
5. Run fmt + lint before committing
