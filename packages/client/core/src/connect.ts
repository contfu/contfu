import type { ItemEvent } from "@contfu/core";
import { connectToWS } from "./ws-client";
import { connectToStream } from "./stream-client";

type ConnectOpts = {
  /** Base URL (without /api/ws or /api/stream path) */
  baseUrl?: string;
  /** Event handler callback */
  handle?: (e: ItemEvent) => Promise<void>;
  /** Enable reconnection on disconnect */
  reconnect?: boolean;
  /** Maximum reconnect delay in ms */
  maxReconnectDelay?: number;
  /** Initial reconnect delay in ms */
  initialReconnectDelay?: number;
  /** Force a specific transport ('ws' | 'stream'), otherwise auto-detect */
  transport?: "ws" | "stream";
};

/**
 * Connect to the sync server using WebSocket (preferred) with binary stream fallback.
 *
 * Tries WebSocket first for optimal performance.
 * Falls back to HTTP binary stream if WebSocket connection fails.
 * Both use the same msgpack wire format for consistency.
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
    transport,
  }: ConnectOpts = {},
): Promise<void | AsyncGenerator<ItemEvent>> {
  const wsUrl = baseUrl.replace(/^http/, "ws") + "/api/ws";
  const streamUrl = baseUrl + "/api/stream";

  const wsOpts = {
    url: wsUrl,
    handle,
    reconnect,
    maxReconnectDelay,
    initialReconnectDelay,
  };

  const streamOpts = {
    url: streamUrl,
    handle,
    reconnect,
    maxReconnectDelay,
    initialReconnectDelay,
  };

  // Force specific transport if requested
  if (transport === "stream") {
    return handle ? connectToStream(key, streamOpts as any) : connectToStream(key, streamOpts);
  }

  if (transport === "ws") {
    return handle ? connectToWS(key, wsOpts as any) : connectToWS(key, wsOpts);
  }

  // Auto-detect: try WS first, fall back to binary stream
  try {
    console.log("[connect] Trying WebSocket...");
    if (handle) {
      return await connectToWS(key, wsOpts as any);
    } else {
      return await connectToWS(key, wsOpts);
    }
  } catch (wsError) {
    console.warn("[connect] WebSocket failed, falling back to binary stream:", wsError);
    if (handle) {
      return connectToStream(key, streamOpts as any);
    } else {
      return connectToStream(key, streamOpts);
    }
  }
}
