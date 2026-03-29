# NATS Integration Spec

## Overview

Port NATS features from pumpit to contfu for:

1. Session storage (better-auth secondary storage)
2. Sync job queue
3. Item event distribution
4. Leader election for scheduler

## Current State (contfu)

- **Sessions**: Stored in PostgreSQL `session` table
- **Sync jobs**: Database-based queue in `syncJobTable`
- **Item events**: SSE via `stream-server.ts`

## Target State

### 1. NATS Infrastructure (`packages/service/backend/src/infra/nats/`)

```
nats/
  connection.ts    # NATS connection with reconnect
  jsm.ts          # JetStream manager
  kvm.ts          # Key-Value manager
  leader-election.ts  # Leader election for scheduler
```

### 2. Session Storage

Create `secondary-storage.ts` implementing better-auth's `SecondaryStorage` interface:

- Use NATS KV for fast session lookups
- Keep PostgreSQL as primary (for persistence)
- LRU cache for hot sessions
- Binary serialization for efficiency

### 3. Sync Job Queue (`packages/service/backend/src/infra/queue/`)

```
queue/
  index.ts        # Auto-select NATS vs local based on env
  queue.ts        # Queue interface
  nats-queue.ts   # NATS JetStream implementation
  local-queue.ts  # Local fallback for dev
```

Replace database-based queue with JetStream:

- Workers claim jobs from stream
- Explicit ack/nak for reliability
- Dead letter queue for failed jobs

### 4. Item Event Distribution

Options:
a) **JetStream** - Durable, but higher latency
b) **Core NATS pub/sub** - Lower latency, suitable for ephemeral events
c) **Keep SSE** - NATS only for internal, SSE for external clients

Recommendation: Keep SSE for client connections, use NATS internally for multi-instance coordination.

## Files to Create

| File                              | Purpose                   |
| --------------------------------- | ------------------------- |
| `infra/nats/connection.ts`        | NATS connection setup     |
| `infra/nats/jsm.ts`               | JetStream manager         |
| `infra/nats/kvm.ts`               | KV manager                |
| `infra/nats/leader-election.ts`   | Scheduler leader election |
| `infra/queue/queue.ts`            | Queue interface           |
| `infra/queue/nats-queue.ts`       | NATS implementation       |
| `infra/queue/local-queue.ts`      | Local fallback            |
| `infra/queue/index.ts`            | Auto-selection            |
| `infra/auth/secondary-storage.ts` | Session KV storage        |

## Environment Variables

```
NATS_SERVER=nats://localhost:4222  # Comma-separated for cluster
```

## Migration Steps

1. Add NATS dependencies
2. Create NATS infrastructure files
3. Create queue abstraction
4. Update sync worker to use queue
5. Add session secondary storage
6. Update docker-compose with NATS
7. Test locally and in CI

## Dependencies

```json
{
  "@nats-io/transport-node": "^3.x",
  "@nats-io/jetstream": "^3.x",
  "@nats-io/kv": "^3.x"
}
```

## Questions for Sven

1. Should item events go through NATS or keep current SSE architecture?
2. Do we need NATS in CI/tests or only production?
3. Priority order for the three use cases?
