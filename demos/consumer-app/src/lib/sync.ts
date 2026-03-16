/**
 * Sync client for connecting to the Contfu service.
 * Uses binary HTTP streaming for content synchronization.
 */

import { connectToStream } from "@contfu/connect";
import { EventType } from "@contfu/core";
import { handleItemChangedEvent, handleItemDeletedEvent } from "./state.svelte.js";
import { env } from "$env/dynamic/private";

/** Get configuration from environment (using SvelteKit's dynamic env with process.env fallback) */
function getConfig() {
  // Try SvelteKit's dynamic env first, then fall back to process.env
  const CONTFU_URL = env?.CONTFU_URL ?? process.env.CONTFU_URL ?? "http://localhost:5173/api/sync";
  const CONTFU_KEY = env?.CONTFU_KEY ?? process.env.CONTFU_KEY ?? "";
  return { CONTFU_URL, CONTFU_KEY };
}

/** Track if sync has been started */
let syncStarted = false;
let syncConnected = false;
let lastDisconnectedReason: string | null = null;

/**
 * Start the sync connection to the sync service.
 * Uses binary HTTP streaming for real-time content synchronization.
 * This should be called once when the server starts.
 */
export async function startSyncConnection(): Promise<void> {
  console.info("[SYNC] startSyncConnection called");

  if (syncStarted) {
    console.info("[SYNC] Already started, skipping");
    return;
  }
  syncStarted = true;

  const { CONTFU_URL, CONTFU_KEY } = getConfig();
  console.info(
    `[SYNC] Config: URL=${CONTFU_URL}, KEY=${CONTFU_KEY ? CONTFU_KEY.slice(0, 8) + "..." : "NOT SET"}`,
  );

  if (!CONTFU_KEY) {
    console.error("[SYNC] Warning: CONTFU_KEY not set - sync connection disabled");
    syncConnected = false;
    lastDisconnectedReason = "Missing CONTFU_KEY";
    return;
  }

  const key = Buffer.from(CONTFU_KEY, "base64url");

  console.info(`[SYNC] Connecting to sync service via binary stream at ${CONTFU_URL}...`);

  try {
    console.info("[SYNC] Attempting connection...");

    for await (const event of connectToStream({ key, url: CONTFU_URL, connectionEvents: true })) {
      if (event.type === "stream:connected") {
        console.info("[SYNC] Connection established!");
        syncConnected = true;
        lastDisconnectedReason = null;
        continue;
      }
      if (event.type === "stream:disconnected") {
        console.warn("[SYNC] Disconnected:", event.reason);
        syncConnected = false;
        lastDisconnectedReason = event.reason ?? "Disconnected";
        continue;
      }

      switch (event.type) {
        case EventType.ITEM_CHANGED:
          handleItemChangedEvent(event);
          console.info(
            `Article updated: ${(event.item.props as { title?: string }).title || "Untitled"}`,
          );
          break;
        case EventType.ITEM_DELETED:
          handleItemDeletedEvent(event);
          console.info(`Article deleted: ${event.item.toString("hex")}`);
          break;
      }
    }
  } catch (error) {
    console.error("[SYNC] Connection error:", error);
    syncStarted = false;
    syncConnected = false;
    lastDisconnectedReason = error instanceof Error ? error.message : "Unknown error";
    // Retry connection after a delay
    console.info("[SYNC] Will retry in 5 seconds...");
    setTimeout(() => void startSyncConnection(), 5000);
  }
}

/**
 * Get the current sync connection URL.
 */
export function getSyncUrl(): string {
  return getConfig().CONTFU_URL;
}

export function getSyncStatus(): { started: boolean; connected: boolean; reason: string | null } {
  return {
    started: syncStarted,
    connected: syncConnected,
    reason: syncConnected ? null : lastDisconnectedReason,
  };
}
