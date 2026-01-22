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
bun test --filter @contfu/sync-service

# Run tests in a specific directory
cd backend/sync && bun test

# Run a specific test file
bun test backend/sync/src/server.spec.ts

# Development mode for all packages
bun run dev

# Format and lint (root level - uses oxfmt and oxlint)
bun run fmt
bun run lint

# Run sync service locally
cd backend/sync && bun run dev

# Run app service locally
cd backend/app && bun run dev

# Docker compose for full stack
docker-compose up
```

## Code Quality

**IMPORTANT: Always format and lint code after completing a task.**

After making any code changes, run the following commands:

```bash
# Format all code (root level - uses oxfmt)
bun run fmt

# Lint all code (root level - uses oxlint)
bun run lint
```

This ensures consistent code style and catches potential issues before committing changes.

## Architecture

### Monorepo Structure (Bun workspaces)

**Core Packages** (`packages/`):

- `@contfu/core` (`packages/core`) - Shared types and interfaces (items, collections, commands, events, sources, blocks)
- `@contfu/client` (`packages/client/client`) - WebSocket client for consuming synced data (msgpackr serialization)
- `@contfu/client-core` (`packages/client/core`) - Client-side database utilities (Kysely)
- `@contfu/bun-file-store` (`packages/client/bun-file-store`) - File storage utilities for Bun
- `@contfu/media-optimizer` (`packages/client/media-optimizer`) - Media optimization utilities using Sharp

**Backend Services** (`backend/`):

- `@contfu/sync-service` (`backend/sync`) - Elysia WebSocket server for real-time sync; handles client connections, authentication, and item streaming via RxJS; includes Notion adapter
- `@contfu/app` (`backend/app`) - Qwik City web application with Bun server adapter

### Key Technologies

- **Runtime**: Bun
- **Database**: SQLite/libSQL with Drizzle ORM (server), Kysely (client)
- **Sync Service**: Elysia framework, WebSocket, RxJS for reactive streams
- **App Service**: Qwik City, Vite, TailwindCSS
- **Serialization**: msgpackr for binary WebSocket messages
- **Auth**: Arctic (OAuth), Argon2 (passwords)

### Data Flow

1. CMS sources (e.g., Notion) are polled/synced via adapters in `backend/sync/src/sources/`
2. Items flow through the sync service which buffers and broadcasts via WebSocket
3. Clients connect with authentication keys, receive real-time item events
4. Events use a compact binary format: `[EventType, collection, id, createdAt, changedAt, [ref, props, content?]]`

### Database Schema

Database schemas are located in:

- `backend/app/src/db/schema.ts` - App service schema (users, etc.)
- `backend/sync/src/db/schema.ts` - Sync service schema
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
