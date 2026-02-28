import { EventType } from "@contfu/core";
import { connectToStream, type StreamEvent, type SyncEvent } from "./stream-client";

type BaseOpts = {
  /** Consumer key. If not provided, CONTFU_API_KEY env var (base64url) is used. */
  key?: Buffer;
  /** Base URL (without /api/sync path). Defaults to CONTFU_API_URL env var or http://localhost:5173 */
  baseUrl?: string;
  /** Event index to replay from. Events since this index will be replayed before live events. */
  from?: number;
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
 * Connect to the sync server using binary streaming.
 *
 * Returns an async generator that yields events. Connection and
 * reconnection happen automatically in the background.
 *
 * The consumer key can be provided via opts or the `CONTFU_API_KEY` environment variable (base64url-encoded).
 *
 * @example
 * ```ts
 * import { connect } from "@contfu/client";
 * import { EventType } from "@contfu/core";
 *
 * // Key from CONTFU_API_KEY env var
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
  const { baseUrl = "https://contfu.com", key, from, connectionEvents, ...rest } = opts;
  const streamUrl = baseUrl != null ? baseUrl + "/api/sync" : undefined;

  if (connectionEvents) {
    return connectToStream({ key, url: streamUrl, from, connectionEvents: true, ...rest });
  }
  return connectToStream({ key, url: streamUrl, from, ...rest });
}
