import { connect } from "contfu";
import { mediaStore } from "$lib/server/media";
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
      if (event.type === "stream:connected") {
        setSyncStatus({ state: "connected", reason: null });
      } else if (event.type === "stream:snapshot:start") {
        setSyncStatus({ state: "syncing", reason: null });
      } else if (event.type === "stream:snapshot:end") {
        setSyncStatus({ state: "connected", reason: null });
      } else if (event.type === "stream:disconnected") {
        setSyncStatus({
          state: "error",
          reason: event.reason ?? "Disconnected from sync service",
        });
      }
      // item events are persisted inside connect
    }
  } catch (error) {
    setSyncStatus({
      state: "error",
      reason: error instanceof Error ? error.message : "Unknown sync error",
    });
  }
}
