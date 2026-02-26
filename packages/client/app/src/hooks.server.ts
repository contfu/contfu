import { connect } from "contfu";
import { EventType } from "@contfu/core";
import { mediaStore } from "$lib/server/media";
import { bufferDataChanged, publishSyncStatus } from "$lib/server/live-updates";
import { setSyncStatus } from "$lib/server/sync-status";

let streamRunnerStarted = false;

export function init() {
  if (streamRunnerStarted) {
    return;
  }

  if (typeof process !== "undefined" && process.env.CONTFU_API_KEY) {
    streamRunnerStarted = true;
    setSyncStatus({ state: "connecting", reason: null });
    void runStream();
  } else {
    setSyncStatus({ state: "disabled", reason: "Missing CONTFU_API_KEY" });
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
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_START) {
        const next = { state: "syncing", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SNAPSHOT_END) {
        const next = { state: "connected", reason: null } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.STREAM_DISCONNECTED) {
        const next = {
          state: "error",
          reason: event.reason ?? "Disconnected from sync service",
        } as const;
        setSyncStatus(next);
        publishSyncStatus(next);
      } else if (event.type === EventType.SCHEMA) {
        bufferDataChanged("schema");
      } else if (event.type === EventType.CHANGED || event.type === EventType.DELETED) {
        bufferDataChanged("item");
      } else {
        bufferDataChanged("unknown");
      }
      // item events are persisted inside connect
    }
  } catch (error) {
    const next = {
      state: "error",
      reason: error instanceof Error ? error.message : "Unknown sync error",
    } as const;
    setSyncStatus(next);
    publishSyncStatus(next);
  }
}
