import type { ItemEvent } from "@contfu/core";
import { connectToWS } from "./ws-client";
import { connectToSSE } from "./sse-client";

type ConnectOpts = {
  /** Base URL (without /api/ws or /api/sse path) */
  baseUrl?: string;
  /** Event handler callback */
  handle?: (e: ItemEvent) => Promise<void>;
  /** Enable reconnection on disconnect */
  reconnect?: boolean;
  /** Maximum reconnect delay in ms */
  maxReconnectDelay?: number;
  /** Initial reconnect delay in ms */
  initialReconnectDelay?: number;
  /** Force a specific transport ('ws' | 'sse'), otherwise auto-detect */
  transport?: "ws" | "sse";
};

/**
 * Connect to the sync server using WebSocket (preferred) with SSE fallback.
 *
 * Tries WebSocket first for binary MessagePack support.
 * Falls back to SSE if WebSocket connection fails.
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
  const sseUrl = baseUrl + "/api/sse";

  const wsOpts = {
    url: wsUrl,
    handle,
    reconnect,
    maxReconnectDelay,
    initialReconnectDelay,
  };

  const sseOpts = {
    url: sseUrl,
    handle,
    reconnect,
    maxReconnectDelay,
    initialReconnectDelay,
  };

  // Force specific transport if requested
  if (transport === "sse") {
    return handle ? connectToSSE(key, sseOpts as any) : connectToSSE(key, sseOpts);
  }

  if (transport === "ws") {
    return handle ? connectToWS(key, wsOpts as any) : connectToWS(key, wsOpts);
  }

  // Auto-detect: try WS first, fall back to SSE
  try {
    console.log("[connect] Trying WebSocket...");
    if (handle) {
      return await connectToWS(key, wsOpts as any);
    } else {
      return await connectToWS(key, wsOpts);
    }
  } catch (wsError) {
    console.warn("[connect] WebSocket failed, falling back to SSE:", wsError);
    if (handle) {
      return connectToSSE(key, sseOpts as any);
    } else {
      return connectToSSE(key, sseOpts);
    }
  }
}
