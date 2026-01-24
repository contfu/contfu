/**
 * WebSocket sync client for connecting to the Contfu service.
 */

import { connectTo } from "@contfu/client";
import { EventType } from "@contfu/core";
import { handleChangedEvent, handleDeletedEvent } from "./state.svelte.js";

/** Configuration from environment */
const CONTFU_URL = process.env.CONTFU_URL || "ws://localhost:3000/contfu";
const CONTFU_KEY = process.env.CONTFU_KEY || "";

/** Track if sync has been started */
let syncStarted = false;

/**
 * Start the WebSocket connection to the sync service.
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

  console.info(`Connecting to sync service at ${CONTFU_URL}...`);

  try {
    await connectTo(key, {
      url: CONTFU_URL,
      handle: async (event) => {
        switch (event.type) {
          case EventType.CHANGED:
            handleChangedEvent(event);
            console.info(
              `Article updated: ${(event.item.props as { title?: string }).title || "Untitled"}`
            );
            break;
          case EventType.DELETED:
            handleDeletedEvent(event);
            console.info(`Article deleted: ${event.item.toString("hex")}`);
            break;
          case EventType.LIST_IDS:
            console.info(
              `Received ${event.ids.length} IDs for collection ${event.collection}`
            );
            break;
          case EventType.CHECKSUM:
            console.info(`Received checksum for collection ${event.collection}`);
            break;
        }
      },
    });
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
