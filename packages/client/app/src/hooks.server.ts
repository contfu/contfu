import { connect } from "@contfu/client";
import { EventType } from "@contfu/core";
import { mediaStore } from "$lib/server/media";
import { bufferDataChanged, publishSyncStatus } from "$lib/server/live-updates";
import { setSyncStatus } from "$lib/server/sync-status";

let streamRunnerStarted = false;

export function init() {
  if (streamRunnerStarted) {
    return;
  }

  if (typeof process !== "undefined" && process.env.CONTFU_KEY) {
    streamRunnerStarted = true;
    console.log("[contfu] connecting to sync service…");
    setSyncStatus({ state: "connecting", reason: null });
    void runStream();
  } else {
    console.log("[contfu] sync disabled — CONTFU_KEY not set");
    setSyncStatus({ state: "disabled", reason: "Missing CONTFU_KEY" });
  }
}

async function runStream() {
  // Lazy-load media optimizer to avoid crashing when native deps (sharp, ffmpeg) are unavailable
  let mediaOptimizer;
  try {
    mediaOptimizer = (await import("$lib/server/media-optimizer")).mediaOptimizer;
  } catch {
    // Media optimization unavailable — sync will still work without it
  }

  try {
    for await (const event of connect({
      connectionEvents: true,
      reconnect: true,
      mediaStore,
      mediaOptimizer,
    })) {
      if (event.type === EventType.STREAM_CONNECTED) {
        console.log("[contfu] stream connected");
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_START) {
        console.log("[contfu] snapshot sync started");
        const next = { state: "syncing", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_END) {
        console.log("[contfu] snapshot sync complete");
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.STREAM_DISCONNECTED) {
        console.error("[contfu] stream disconnected:", event.reason);
        const next = {
          state: "error",
          reason: event.reason ?? "Disconnected from sync service",
        } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.COLLECTION_SCHEMA) {
        bufferDataChanged("schema");
      } else if (event.type === EventType.ITEM_CHANGED || event.type === EventType.ITEM_DELETED) {
        bufferDataChanged("item");
      } else {
        bufferDataChanged("unknown");
      }
      // item events are persisted inside connect
    }
  } catch (error) {
    console.error("[contfu] sync error:", error);
    const next = {
      state: "error",
      reason: error instanceof Error ? error.message : "Unknown sync error",
    } as const;
    setSyncStatus(next);
    publishSyncStatus(next);
  }
}
