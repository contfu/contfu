/**
 * Sync client for connecting to the Contfu service.
 * Uses Server-Sent Events (SSE) by default, WebSocket if USE_WEBSOCKET=true.
 */

import { connectTo, connectToSSE } from "@contfu/client";
import { EventType } from "@contfu/core";
import { handleChangedEvent, handleDeletedEvent } from "./state.svelte.js";
// Server-side EventSource polyfill for SSE connections
import EventSource from "eventsource";

/** Configuration from environment */
const USE_WEBSOCKET = process.env.USE_WEBSOCKET === "true";
const CONTFU_URL =
  process.env.CONTFU_URL ||
  (USE_WEBSOCKET ? "ws://localhost:3000/contfu" : "http://localhost:5173/api/sse");
const CONTFU_KEY = process.env.CONTFU_KEY || "";

/** Track if sync has been started */
let syncStarted = false;

/**
 * Start the sync connection to the sync service.
 * Uses SSE by default, WebSocket if USE_WEBSOCKET environment variable is set to "true".
 * This should be called once when the server starts.
 */
export async function startSyncConnection(): Promise<void> {
  if (syncStarted) {
    return;
  }
  syncStarted = true;

  if (!CONTFU_KEY) {
    console.error("Warning: CONTFU_KEY not set - sync connection disabled");
    return;
  }

  const key = Buffer.from(CONTFU_KEY, "hex");
  const connectionType = USE_WEBSOCKET ? "WebSocket" : "SSE";

  console.info(`Connecting to sync service via ${connectionType} at ${CONTFU_URL}...`);

  const eventHandler = async (event: any) => {
    switch (event.type) {
      case EventType.CHANGED:
        handleChangedEvent(event);
        console.info(
          `Article updated: ${(event.item.props as { title?: string }).title || "Untitled"}`,
        );
        break;
      case EventType.DELETED:
        handleDeletedEvent(event);
        console.info(`Article deleted: ${event.item.toString("hex")}`);
        break;
      case EventType.LIST_IDS:
        console.info(`Received ${event.ids.length} IDs for collection ${event.collection}`);
        break;
      case EventType.CHECKSUM:
        console.info(`Received checksum for collection ${event.collection}`);
        break;
    }
  };

  try {
    if (USE_WEBSOCKET) {
      await connectTo(key, {
        url: CONTFU_URL,
        handle: eventHandler,
      });
    } else {
      await connectToSSE(key, {
        url: CONTFU_URL,
        handle: eventHandler,
        EventSource: EventSource as any,
      });
    }
  } catch (error) {
    console.error("Sync connection error:", error);
    syncStarted = false;
    // Retry connection after a delay
    setTimeout(startSyncConnection, 5000);
  }
}

/**
 * Get the current sync connection URL.
 */
export function getSyncUrl(): string {
  return CONTFU_URL;
}
