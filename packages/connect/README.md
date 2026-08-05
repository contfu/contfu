# @contfu/connect

Connector package for Contfu runtimes.

Connects to Contfu and yields typed Sync Messages as an async generator. Handles reconnection automatically by default.

## Usage

```ts
import { connect } from "@contfu/connect";
import { EventType } from "@contfu/core";

for await (const event of connect()) {
  if (event.type === EventType.ITEM_CHANGED) {
    console.log(event.item);
  }
}
```

## Options

```ts
connect({
  key?: Buffer,                  // Auth key (falls back to CONTFU_KEY env var)
  reconnect?: boolean,           // Auto-reconnect on disconnect (default: true)
  initialReconnectDelay?: number, // ms, default 1000
  maxReconnectDelay?: number,     // ms, default 30000
  connectionEvents?: boolean,     // Yield stream lifecycle events as well as sync events
});
```

Pass `reconnect: false` when the caller should receive the first connection error instead of retrying.

## Events

`connect()` yields sync events from `@contfu/core`'s numeric `EventType` enum:

- `EventType.ITEM_CHANGED`
- `EventType.ITEM_DELETED`
- `EventType.COLLECTION_SCHEMA`
- `EventType.COLLECTION_RENAMED`
- `EventType.COLLECTION_REMOVED`

With `connectionEvents: true`, it can also yield stream lifecycle events:

- `EventType.STREAM_CONNECTED`
- `EventType.STREAM_DISCONNECTED`
- `EventType.SNAPSHOT_START`
- `EventType.SNAPSHOT_END`

The package also exports `connectToStream` and the public event/item TypeScript types used by these generators.
