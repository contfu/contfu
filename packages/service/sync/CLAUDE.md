# CLAUDE.md - @contfu/svc-sync

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/svc-sync`
**Version:** 0.1.1
**Purpose:** Real-time WebSocket server that syncs data from CMS sources to connected clients

This is the core backend service handling CMS polling, item buffering, and WebSocket broadcasting.

## Architecture

### Module Structure

```
src/
├── index.ts              # Entry point (RxJS merge of streams)
├── server.ts             # Elysia WebSocket server setup
├── db/
│   ├── schema.ts         # Drizzle ORM schemas
│   └── db.ts             # Database connection
├── sync/
│   ├── sync-service.ts   # RxJS-based sync orchestration
│   ├── sync-constants.ts # Configuration constants
│   ├── sync.ts           # Core sync logic
│   ├── events.ts         # Event processing
│   └── items.ts          # Item handling
├── sources/
│   ├── source.ts         # Base source interface
│   └── notion/           # Notion CMS adapter
│       ├── notion-source.ts
│       ├── notion-items.ts
│       ├── notion-collections.ts
│       ├── notion-blocks.ts
│       ├── notion-helpers.ts
│       ├── notion.ts
│       └── __fixtures__/
├── data/
│   ├── data.ts           # Data operations
│   ├── data-repository.ts
│   └── db/data-datasource.ts
├── access/
│   ├── access.ts         # Consumer access logic
│   ├── access-repository.ts
│   ├── access-plugin.ts  # Elysia plugin
│   └── db/access-datasource.ts
└── util/
    ├── structures/sorted-set.ts  # Binary search sorted set
    ├── numbers/numbers.ts
    └── ids/ids.ts
```

### Core Patterns

**RxJS Reactive Streams:**

- `processItems$` - Processes incoming items from sources
- `sync$` - Orchestrates sync timing and partitioning
- Streams are merged in `index.ts` for unified execution

**WebSocket Protocol:**

- Binary msgpackr serialization
- Event format: `[EventType, collection, id, createdAt, changedAt, [ref, props, content?]]`
- Commands: CONNECT, ACK

**Memory Efficiency:**

- Binary-compressed consumer ID storage
- Active consumer tracking with minimal memory footprint
- Timer-based polling with MIN_FETCH_INTERVAL

### Database Schema

**Tables:** user, session, quota, consumer, source, collection

Schema location: `src/db/schema.ts`

## Libraries

| Library                 | Version      | Purpose                        |
| ----------------------- | ------------ | ------------------------------ |
| elysia                  | ^1.1.19      | HTTP/WebSocket framework       |
| rxjs                    | ^7.8.1       | Reactive streams               |
| msgpackr                | ^1.9.4       | Binary serialization           |
| notion-client-web-fetch | ^2.2.15      | Notion API client              |
| postgres                | ^3.4.4       | PostgreSQL driver              |
| @sinclair/typebox       | ^0.33.15     | JSON schema generation         |
| @sinonjs/fake-timers    | ^13.0.4      | Time mocking for tests         |
| @contfu/core            | workspace:\* | Type definitions               |
| @contfu/client          | workspace:\* | WebSocket client (dev)         |
| @electric-sql/pglite    | ^0.2.11      | In-memory PostgreSQL for tests |
| ts-essentials           | ^10.0.2      | TypeScript utilities           |

## Coding Best Practices

1. **RxJS patterns:** Use operators like `merge`, `switchMap`, `filter` for stream composition
2. **Binary protocol:** Always use msgpackr for WebSocket messages
3. **Memory efficiency:** Track consumers with binary compression
4. **Source abstraction:** Implement CMS adapters via the source interface
5. **Error isolation:** Errors in one stream shouldn't crash others

## Development Process

### Testing

Tests use Bun with fake timers and mock sources.

```bash
# Run all tests
bun test

# Run specific test
bun test src/server.spec.ts
```

**Test patterns:**

- Fake timers (`@sinonjs/fake-timers`) for time-dependent code
- Mock Notion source implementation
- WebSocket client integration tests
- Database seeding with test fixtures

**Test files:**

- `src/server.spec.ts` - Integration tests
- `src/util/*/\*.spec.ts` - Unit tests for utilities

### Commands

```bash
# Development
bun run dev

# Run tests
bun test

# Build
bun run build
```

### Making Changes

1. Follow RxJS patterns for async operations
2. Add tests for new functionality
3. Test WebSocket protocol changes with `@contfu/client`
4. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- RxJS is excellent for managing complex async data flows
- Elysia provides fast WebSocket handling with minimal overhead
- Binary consumer ID storage significantly reduces memory usage
- Fake timers are essential for testing timer-based sync logic
- Integration tests with real WebSocket connections catch protocol issues
