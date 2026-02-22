import { connect } from "contfu";
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
  try {
    for await (const event of connect({ connectionEvents: true, reconnect: true })) {
      if (event.type === "stream:connected") {
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
