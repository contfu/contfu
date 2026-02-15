import type { ItemEvent } from "@contfu/core";
import { connectToStream, type StreamEvent } from "./stream-client";

type BaseOpts = {
  /** Base URL (without /api/stream path) */
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
 * @example
 * ```ts
 * import { connect } from "@contfu/client";
 *
 * const key = Buffer.from(apiKey, "hex");
 *
 * // Simple usage
 * for await (const event of connect(key)) {
 *   if (event.type === 2) { // CHANGED
 *     console.log("Item changed:", event.item);
 *   }
 * }
 *
 * // With connection events
 * for await (const event of connect(key, { connectionEvents: true })) {
 *   if (event.type === "stream:connected") {
 *     console.log("Connected!");
 *   } else if (event.type === "stream:disconnected") {
 *     console.log("Lost connection:", event.reason);
 *   } else {
 *     console.log("Item event:", event);
 *   }
 * }
 * ```
 */
export function connect(
  key: Buffer,
  opts: OptsWithConnectionEvents,
): AsyncGenerator<ItemEvent | StreamEvent>;
export function connect(key: Buffer, opts?: OptsWithoutConnectionEvents): AsyncGenerator<ItemEvent>;
export function connect(
  key: Buffer,
  opts: BaseOpts & { connectionEvents?: boolean } = {},
): AsyncGenerator<ItemEvent | StreamEvent> {
  const { baseUrl = "https://contfu.com", from, connectionEvents, ...rest } = opts;
  const streamUrl = baseUrl + "/api/stream";

  if (connectionEvents) {
    return connectToStream(key, { url: streamUrl, from, connectionEvents: true, ...rest });
  }
  return connectToStream(key, { url: streamUrl, from, ...rest });
}
