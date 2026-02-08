import type { ItemEvent } from "@contfu/core";
import { connectToStream } from "./stream-client";

type ConnectOpts = {
  /** Base URL (without /api/stream path) */
  baseUrl?: string;
  /** Event handler callback */
  handle?: (e: ItemEvent) => Promise<void>;
  /** Enable reconnection on disconnect */
  reconnect?: boolean;
  /** Maximum reconnect delay in ms */
  maxReconnectDelay?: number;
  /** Initial reconnect delay in ms */
  initialReconnectDelay?: number;
};

/**
 * Connect to the sync server using binary streaming.
 *
 * Uses HTTP binary stream with msgpack encoding for efficient,
 * browser-compatible real-time sync.
 */
export function connect(
  key: Buffer,
  opts: ConnectOpts & { handle: (e: ItemEvent) => Promise<void> },
): Promise<void>;
export function connect(
  key: Buffer,
  opts?: Omit<ConnectOpts, "handle">,
): Promise<AsyncGenerator<ItemEvent>>;
export async function connect(
  key: Buffer,
  {
    baseUrl = "https://contfu.com",
    handle,
    reconnect = true,
    maxReconnectDelay = 30_000,
    initialReconnectDelay = 1_000,
  }: ConnectOpts = {},
): Promise<void | AsyncGenerator<ItemEvent>> {
  const streamUrl = baseUrl + "/api/stream";

  const streamOpts = {
    url: streamUrl,
    handle,
    reconnect,
    maxReconnectDelay,
    initialReconnectDelay,
  };

  if (handle) {
    return connectToStream(key, streamOpts as Parameters<typeof connectToStream>[1] & { handle: (e: ItemEvent) => Promise<void> });
  }
  return connectToStream(key, streamOpts);
}
