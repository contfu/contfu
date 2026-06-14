export type SyncIntegrationState = "disabled" | "connecting" | "syncing" | "connected" | "error";

export type SyncStatus = {
  state: SyncIntegrationState;
  reason: string | null;
};

let status: SyncStatus = { state: "disabled", reason: null };

export function setSyncStatus(next: SyncStatus) {
  status = next;
}

export function getSyncStatus(): SyncStatus {
  return status;
}
