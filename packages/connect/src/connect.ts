import { connectToStream, type StreamEvent, type SyncEvent } from "./stream-client";

type BaseOpts = {
  /** Authentication key. If not provided, CONTFU_KEY env var (base64url) is used. */
  key?: Buffer;
  /** Enable automatic reconnection on disconnect (default: true) */
  reconnect?: boolean;
  /** Maximum delay between reconnection attempts in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Initial delay before first reconnection attempt in ms (default: 1000) */
  initialReconnectDelay?: number;
};

type OptsWithConnectionEvents = BaseOpts & { connectionEvents: true };
type OptsWithoutConnectionEvents = BaseOpts & { connectionEvents?: false };

/**
 * Connect to the Cloud Service using the active Connector transport.
 *
 * Returns an async generator that yields Sync Messages. Connection and
 * reconnection happen automatically in the background.
 *
 * The authentication key can be provided via opts or the `CONTFU_KEY` environment variable (base64url-encoded).
 * Sync connects to Contfu Cloud over WebSocket first and automatically falls back to HTTP streaming when WebSocket setup is unavailable.
 *
 * @example
 * ```ts
 * import { connect } from "@contfu/connect";
 * import { EventType } from "@contfu/core";
 *
 * // Key from CONTFU_KEY env var
 * for await (const event of connect()) {
 *   if (event.type === EventType.ITEM_CHANGED) {
 *     console.log("Item changed:", event.item);
 *   }
 * }
 *
 * // With explicit key and connection events
 * for await (const event of connect({ key, connectionEvents: true })) {
 *   if (event.type === EventType.STREAM_CONNECTED) {
 *     console.log("Connected!");
 *   } else if (event.type === EventType.STREAM_DISCONNECTED) {
 *     console.log("Lost connection:", event.reason);
 *   } else {
 *     console.log("Item event:", event);
 *   }
 * }
 * ```
 */
export function connect(opts: OptsWithConnectionEvents): AsyncGenerator<SyncEvent | StreamEvent>;
export function connect(opts?: OptsWithoutConnectionEvents): AsyncGenerator<SyncEvent>;
export function connect(
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): AsyncGenerator<SyncEvent | StreamEvent> {
  const { key, connectionEvents, ...rest } = opts;

  if (connectionEvents) {
    return connectToStream({ key, connectionEvents: true, ...rest });
  }
  return connectToStream({ key, ...rest });
}
