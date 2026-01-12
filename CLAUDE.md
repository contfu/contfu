# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Contfu ("content funnel") is a platform that allows application and web developers to consume data from multiple CMS systems. It supports two deployment modes:
- **Self-hosted**: Single client connected to all collections with streaming, collections, and schema versioning
- **Server-hosted**: Multi-client support with media optimization, backups, and automation

## Common Commands

```bash
# Install dependencies
bun install

# Run all tests across workspaces
bun test

# Build all packages
bun run build

# Run a single package's tests
bun test --filter @contfu/sync

# Run tests in a specific directory
cd packages/sync/core && bun test

# Run a specific test file
bun test packages/sync/core/src/mappings.spec.ts

# Development mode for all packages
bun run dev

# Lint (app service only)
cd services/app && bun run lint

# Run sync service locally
cd services/sync && bun run dev

# Run app service locally
cd services/app && bun run dev

# Docker compose for full stack
docker-compose up
```

## Architecture

### Monorepo Structure (Bun workspaces)

**Core Packages** (`packages/`):
- `@contfu/core` - Shared types and interfaces (items, collections, commands, events, sources, blocks)
- `@contfu/db` - Database schema (Drizzle ORM with SQLite/libSQL), migrations
- `@contfu/sync` - Sync core logic (mappings, source abstractions)
- `@contfu/notion` - Notion CMS adapter implementing sync interfaces
- `@contfu/client` - WebSocket client for consuming synced data (msgpackr serialization)
- `@contfu/client-core` - Client-side database utilities (Kysely)

**Services** (`services/`):
- `@contfu/sync-service` - Elysia WebSocket server for real-time sync; handles client connections, authentication, and item streaming via RxJS
- `@contfu/app` - Qwik City web application with Bun server adapter

### Key Technologies

- **Runtime**: Bun
- **Database**: SQLite/libSQL with Drizzle ORM (server), Kysely (client)
- **Sync Service**: Elysia framework, WebSocket, RxJS for reactive streams
- **App Service**: Qwik City, Vite, TailwindCSS
- **Serialization**: msgpackr for binary WebSocket messages
- **Auth**: Arctic (OAuth), Argon2 (passwords)

### Data Flow

1. CMS sources (e.g., Notion) are polled/synced via adapters in `packages/sync/`
2. Items flow through the sync service which buffers and broadcasts via WebSocket
3. Clients connect with authentication keys, receive real-time item events
4. Events use a compact binary format: `[EventType, collection, id, createdAt, changedAt, [ref, props, content?]]`

### Database Schema

Core entities in `packages/db/src/schema.ts`:
- `user` - Users with email/OAuth authentication
- `source` - CMS connections (type, credentials, URL)
- `collection` - Groups of items from a source
- `consumer` - API clients that consume collections
- `connection` - Links consumers to collections with sync state

### Docker Targets

The Dockerfile has three targets:
- `migrator` - Runs database migrations
- `sync` - Sync WebSocket service (port 3000)
- `app` - Qwik web application (port 3000)
