---
name: contfu-binary-streaming
description: Work with Contfu's binary streaming real-time sync system. Use when implementing consumers, debugging event delivery, or modifying the wire protocol.
---

# Contfu Binary Streaming

Contfu uses **binary streaming** over HTTP to push content changes to connected clients in real-time. This replaced the deprecated SSE system.

## Architecture

```
┌─────────────┐    Binary     ┌─────────────┐
│   Client    │ ◄───────────► │  Stream     │
│ (consumer)  │  /api/stream │  Server     │
└─────────────┘               └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │   NATS      │
                              │  JetStream  │
                              │ (persisted) │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │   Sources   │
                              │ (Notion,    │
                              │  Strapi...) │
                              └─────────────┘
```

## Key Files

- `packages/service/app/src/routes/api/stream/+server.ts` — HTTP endpoint
- `packages/service/backend/src/infra/stream/stream-server.ts` — Stream server logic
- `packages/client/core/src/stream-client.ts` — Client SDK
- `packages/core/src/wire.ts` — Wire protocol types

## Wire Protocol

### Format

Each message is: `[4-byte length (big-endian)][msgpack data]`

```
┌────────────┬─────────────────────┐
│  Length    │   Message Data      │
│  (4 bytes) │   (msgpack)        │
│  big-endian│                    │
└────────────┴─────────────────────┘
```

### Event Types

```typescript
// In packages/core/src/wire.ts
const WIRE_PING = 0;        // Keep-alive
const EventType.CHANGED = 1; // Item created/updated
const EventType.DELETED = 2; // Item deleted
```

### Message Formats

```typescript
// CHANGED: [1, wireItem] or [1, wireItem, eventIndex]
type WireItemEvent = 
  | [1, WireItem]
  | [1, WireItem, number];

// DELETED: [2, itemId] or [2, itemId, eventIndex]
type WireItemEvent = 
  | [2, Uint8Array]
  | [2, Uint8Array, number];

// PING: [0] (no payload)
```

### WireItem Structure

```typescript
type WireItem = [
  ref: Uint8Array,           // Item reference (8 bytes)
  id: Uint8Array,           // Item ID (8 bytes)
  collection: number,        // Collection ID (encoded)
  changedAt: number,         // Unix timestamp
  props: Record<string, unknown>, // Serialized properties
  content?: Block[]         // Optional content blocks
];
```

## Connection Flow

### 1. Client Connects

```typescript
// Client: GET /api/stream?key=<base64>&from=<index>
const response = await fetch('/api/stream?key=' + key.toString('base64url'), {
  headers: { 'Accept': 'application/octet-stream' }
});

const reader = response.body.getReader();
```

### 2. Pre-Authentication

Before stream starts, client key is validated:

```typescript
// In stream-server.ts
async preAuthenticate(key: Buffer): Promise<{ error?: "E_AUTH" | "E_CONFLICT" | "E_ACCESS" }> {
  const client = await authenticateConsumer(key);
  if (!client) return { error: "E_AUTH" };
  
  // Prevent duplicate connections
  const existingConnection = consumerToConnection.get(consumerKey);
  if (existingConnection) return { error: "E_CONFLICT" };
  
  return {};
}
```

Error codes:
- `E_AUTH` — Invalid consumer key
- `E_CONFLICT` — Consumer already connected
- `E_ACCESS` — User doesn't have access

### 3. Stream Established

After pre-auth passes, stream begins:

```typescript
// Server enqueues sync jobs for consumer's collections
const collectionIds = await getConsumerCollectionIds(client.userId, client.id);
if (collectionIds.length > 0) {
  await enqueueSyncJobs(db, sourceCollectionIds);
}
```

## Client Usage

### Basic Connection

```typescript
import { connectToStream } from '@contfu/client-core';

for await (const event of connectToStream(key)) {
  if (event.type === 1) { // CHANGED
    console.log('Item changed:', event.item);
  } else if (event.type === 2) { // DELETED
    console.log('Item deleted:', event.item);
  }
}
```

### With Connection Events

```typescript
for await (const event of connectToStream(key, { connectionEvents: true })) {
  if (event.type === 'stream:connected') {
    console.log('Connected!');
  } else if (event.type === 'stream:disconnected') {
    console.log('Disconnected:', event.reason);
  } else {
    console.log(event.type, event);
  }
}
```

### With Event Replay (from index)

```typescript
// Connect with ?from=<index> to replay missed events
for await (const event of connectToStream(key, { from: 12345 })) {
  // Events include eventIndex for ordering
  if ('eventIndex' in event) {
    console.log('Event index:', event.eventIndex);
  }
}
```

### Error Handling

```typescript
import { IndexExpiredError } from '@contfu/client-core';

try {
  for await (const event of connectToStream(key, { from: lastIndex })) {
    // process event
  }
} catch (err) {
  if (err instanceof IndexExpiredError) {
    // Event index expired, need full resync
    console.log('Full resync required');
  }
}
```

## Server Broadcasting

### Broadcast Changed Items

```typescript
// Items are published to JetStream for persistence
const itemSequences = new Map<Item, number>();
await Promise.all(items.map(item => 
  publishEvent(item.user, item.collection, wireEvent).then(
    seq => itemSequences.set(item, seq)
  )
));

// Then broadcast to connected consumers
for (const conn of connections) {
  const connection = consumerToConnection.get(consumerKey);
  if (connection.indexed) {
    // Include sequence number for replay
    this.sendBinary(connection.controller, [EventType.CHANGED, wireItem, seq]);
  } else {
    this.sendBinary(connection.controller, [EventType.CHANGED, wireItem]);
  }
}
```

### Broadcast Deleted

```typescript
// Publish to JetStream first
await publishEvent(conn.userId, conn.collectionId, [EventType.DELETED, itemId]);

// Then broadcast
this.sendBinary(connection.controller, [EventType.DELETED, itemId]);
```

## Reconnection & Indexing

### Why Indexed Events?

When client reconnects with `?from=<index>`:
1. Server replays all events since that index from JetStream
2. Then streams live events
3. Client can fill gaps from disconnection

### IndexExpiredError (HTTP 410)

If JetStream purges old data (retention policy), client gets 410:
- Client should do full resync (fetch all items)
- Reset `from` parameter to undefined

## Debugging

### Check Active Connections

```typescript
import { consumerToConnection, connectionToConsumer, consumerInfo } from './stream-server';

for (const [key, conn] of consumerToConnection) {
  const info = consumerInfo.get(key);
  console.log(`Consumer ${key}:`, info, conn.id);
}
```

### Common Issues

1. **Connection refused immediately**
   - Check consumer key is valid (32 bytes)
   - Verify key exists in database

2. **Events not received**
   - Ensure consumer is connected to collections
   - Check NATS/JetStream is running

3. **410 Gone (IndexExpiredError)**
   - JetStream retention expired
   - Client needs full resync

4. **Memory leaks**
   - Connections cleaned up on disconnect
   - Pre-auth cache expires after 30s

## Testing

```bash
# Test stream client
bun test packages/client/core/src/stream-client.spec.ts

# Test stream server
bun test packages/service/backend/src/infra/stream/stream-server.spec.ts
```

## Related

- [contfu-development](./contfu-development) — General development workflow
- [contfu-source-adapter](./contfu-source-adapter) — CMS source adapters
