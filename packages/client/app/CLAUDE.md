# CLAUDE.md - contfu (Client App)

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `contfu`
**Version:** 0.1.1
**Purpose:** Client-side application package with local database support

This package provides client-side functionality for applications consuming Contfu data.

## Architecture

### Module Structure

- `src/core/db/schema.ts` - Client-side database schema (pages, etc.)
- `src/index.ts` - Main exports
- `drizzle.config.ts` - Drizzle Kit configuration

### Database

Uses Drizzle ORM with SQLite (better-sqlite3) for client-side data persistence.

**Schema location:** `src/core/db/schema.ts`

### Design Patterns

- **Local-first:** Client-side SQLite for offline capability
- **Drizzle ORM:** Type-safe database operations
- **Migration support:** Drizzle Kit for schema migrations

## Libraries

| Library        | Version        | Purpose                    |
| -------------- | -------------- | -------------------------- |
| drizzle-orm    | ^1.0.0-beta.10 | Type-safe SQL ORM          |
| drizzle-kit    | ^1.0.0-beta.10 | Migration tool             |
| better-sqlite3 | ^11.0.0        | SQLite driver (optional)   |
| @contfu/core   | workspace:\*   | Type definitions (dev)     |
| ts-essentials  | ^10.0.2        | TypeScript utilities (dev) |
| @types/bun     | \*             | Bun type definitions (dev) |

## Coding Best Practices

1. **Schema-first:** Define database schema before writing queries
2. **Type safety:** Leverage Drizzle's TypeScript inference
3. **Migration discipline:** Generate migrations for schema changes
4. **Offline support:** Design for local-first operation

## Development Process

### Testing

```bash
# Run tests
bun test
```

### Database Migrations

```bash
# Generate migration after schema changes
bun run db:generate
```

### Commands

```bash
# Run tests
bun test

# Generate migrations
bun run db:generate

# Clean build artifacts
bun run clean
```

### Making Changes

1. Update schema in `src/core/db/schema.ts`
2. Generate migration: `bun run db:generate`
3. Test database operations
4. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- Drizzle ORM provides excellent TypeScript inference
- better-sqlite3 is optional; package works with other SQLite drivers
- Client-side SQLite enables offline-first functionality
