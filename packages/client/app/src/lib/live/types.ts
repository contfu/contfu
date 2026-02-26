export type LiveSyncConnectionState = "disabled" | "connecting" | "syncing" | "connected" | "error";

export type LiveReadyEvent = {
  type: "ready";
  ts: number;
};

export type LiveSyncStatusEvent = {
  type: "sync-status";
  state: LiveSyncConnectionState;
  reason: string | null;
  ts: number;
};

export type LiveDataChangedKind = "item" | "schema" | "unknown";

export type LiveDataChangedBatchEvent = {
  type: "data-changed-batch";
  count: number;
  kinds: LiveDataChangedKind[];
  windowMs: 3000;
  ts: number;
};

export type LiveEvent = LiveReadyEvent | LiveSyncStatusEvent | LiveDataChangedBatchEvent;
