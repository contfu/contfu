# CLAUDE.md - @contfu/client

> **Keep this file in sync with project changes and document important learnings.**

## Package Overview

**Name:** `@contfu/client`
**Version:** 0.1.1
**Purpose:** WebSocket client for consuming real-time synced data from the sync service

This package provides the client-side connection logic for receiving item events over WebSocket.

## Architecture

### Module Structure

- `src/client.ts` - Main `connectTo()` function for WebSocket connections
- `src/index.ts` - Exports client module

### Connection Patterns

The `connectTo()` function supports two usage patterns:

1. **Async generator mode:** Yields events as they arrive

   ```typescript
   for await (const event of connectTo(url, key)) {
     // handle event
   }
   ```

2. **Callback mode:** Invokes callback for each event
   ```typescript
   connectTo(url, key, (event) => {
     // handle event
   });
   ```

### Data Flow

1. Connect to sync service WebSocket
2. Authenticate with consumer key
3. Receive binary msgpack-encoded events
4. Deserialize events using msgpackr
5. Yield/invoke callback with typed events

## Libraries

| Library      | Version      | Purpose                            |
| ------------ | ------------ | ---------------------------------- |
| @contfu/core | workspace:\* | Type definitions                   |
| msgpackr     | ^1.9.4       | Binary serialization for WebSocket |
| typescript   | ^5.6.3       | Type checking (dev)                |

## Coding Best Practices

1. **Binary protocol:** All WebSocket messages use msgpackr, not JSON
2. **Type safety:** Deserialize events to proper `@contfu/core` types
3. **Error handling:** Handle WebSocket disconnections gracefully
4. **Memory efficiency:** Use generators for streaming to avoid buffering
5. **Reconnection:** Consumers should implement their own reconnection logic

## Development Process

### Testing

No unit tests in this package. Integration tests exist in `backend/sync/src/server.spec.ts` which tests the client against the real sync service.

### Commands

```bash
# Build
bun run build

# Type check
bun run tsc --noEmit
```

### Making Changes

1. Test against the sync service (`backend/sync`)
2. Ensure binary protocol compatibility with server
3. Run `bun run fmt && bun run lint` from root after changes

## Learnings

- msgpackr automatically handles Buffer serialization/deserialization
- WebSocket binary messages are more efficient than JSON for high-frequency updates
- Generator pattern allows for natural async iteration without buffering
