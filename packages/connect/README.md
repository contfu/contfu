# @contfu/connect

Connector package for Contfu Local Runtimes.

Connects to the Contfu Cloud Service and yields typed Sync Messages as an async generator. Handles reconnection automatically.

## Usage

```ts
import { connect } from "@contfu/connect";

for await (const event of connect()) {
  if (event.type === "item-changed") {
    console.log(event.item);
  }
}
```

## Options

```ts
connect({
  key?: Buffer,              // Auth key (falls back to CONTFU_KEY env var)
  reconnect?: boolean,       // Auto-reconnect on disconnect (default: true)
  initialReconnectDelay?: number,  // ms, default 1000
  maxReconnectDelay?: number,      // ms, default 30000
  connectionEvents?: boolean,      // Yield connect/disconnect events
});
```

## Event types

`item-changed`, `item-deleted`, `collection-renamed`, `collection-removed`, `schema-changed`, `sync-started`, `sync-completed`, `stream-connected`, `stream-disconnected`, `stream-snapshot-start`, `stream-snapshot-end`
